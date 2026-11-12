import {
  GeocodeCommand,
  GeoPlacesClient,
  SearchTextCommand,
  type GeocodeCommandOutput,
} from "@aws-sdk/client-geo-places";

// Whether the venues the model names for an option's days exist where it
// says they are: a lookup against a maps service, injected like the models
// so tests and runs without one use the fake. The model's memory of venues
// is not good enough to put a name on a card unchecked.

// A venue as the service knows it: its name, its address together with the
// names of the places it falls in (city, district, county, province), and,
// when the area itself was found on the map, whether the venue lies within
// it: a resort 10 km outside Collingwood is still in "Collingwood, ON".
export type Venue = { name: string; address: string; nearArea?: boolean };

export type Places = {
  source: string;
  // The venues a name turns up in or near an area, best first; empty when
  // it turns up nothing. Throws when the service cannot be asked, which
  // includes a process that has spent its lookups.
  search(name: string, area: string): Promise<Venue[]>;
};

// Knows every venue whose name says what it is, a resort, a park or a
// market, wherever it is asked about; nothing else exists.
export function fakePlaces(): Places {
  return {
    source: "fake",
    async search(name, area) {
      return /resort|park|market/i.test(name) ? [{ name, address: area }] : [];
    },
  };
}

// The part of the SDK client the lookup uses, so a test can hand in a stub.
export type LocationClient = Pick<GeoPlacesClient, "send">;

// A longitude and a latitude.
export type Position = [number, number];

type GeocodeItem = NonNullable<GeocodeCommandOutput["ResultItems"]>[number];

// Results that are places on the map rather than venues in them (a city, a
// district, a street, an address) are not venues.
const venueTypes = new Set(["PointOfInterest"]);

// How far from an area's point a venue may lie and still be in it, by what
// kind of place the area is.
const areaRadiusKm: Record<string, number> = {
  Locality: 30,
  District: 30,
  SubRegion: 100,
  Region: 400,
  Country: 1500,
};

// Letters and digits in lower case without accents, for matching words.
const letters = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// Whether a geocode result is the area, and not a shop that borrowed its
// name: a kind of place, named with every word of the area ("The Blue
// Mountains, ON" for "Blue Mountain"; never "Blue Mountain, 8 Simmons Blvd,
// Brampton", a store).
function isArea(area: string, item: GeocodeItem): boolean {
  if (!Object.hasOwn(areaRadiusKm, item.PlaceType ?? "")) return false;
  const here = letters(
    `${item.Title ?? ""} ${item.Address?.Label ?? ""}`,
  ).split(" ");
  return letters(area)
    .split(" ")
    .filter((word) => word.length >= 3)
    .every((want) => here.some((word) => word.startsWith(want)));
}

// Great-circle distance in kilometres.
function km([lon1, lat1]: Position, [lon2, lat2]: Position): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Area = { position: Position; radiusKm: number };

// Amazon Location Service Places, through the default AWS credential chain
// like Bedrock: the ECS task role in production, the `circles` profile
// locally. It bills the account per request, so it runs on the team's
// credits. The area is geocoded once per process, leaning towards `home`
// (where the group usually is) and trusted only when the map answers with a
// place of that name; then each venue is searched by name near the area,
// or near home when the area was not found, and marked as within the area
// or not. The searches are requested for storage, at that rate, because
// their answers are kept for a month. Every geocode and search is one
// request against the cap, which is a day's per process; past it every
// lookup throws and the venues go unverified until the next day.
export function locationPlaces(
  region: string,
  maxRequests: number,
  home: Position,
  client: LocationClient = new GeoPlacesClient({ region }),
): Places {
  // Requests made today (UTC); the count starts over with the day, so a
  // long-lived process gets its lookups back.
  let used = { day: "", count: 0 };
  // One request against the cap, with the service's refusal made readable.
  const guarded = async <T>(send: () => Promise<T>): Promise<T> => {
    const day = new Date().toISOString().slice(0, 10);
    if (used.day !== day) used = { day, count: 0 };
    if (used.count >= maxRequests)
      throw new Error(
        `Amazon Location lookups capped at ${maxRequests} a day for this process`,
      );
    used.count += 1;
    try {
      return await send();
    } catch (err) {
      const e = err as { name?: string; message?: string };
      throw new Error(
        `Amazon Location answered ${e.name ?? "an error"}: ${e.message ?? String(err)}`,
      );
    }
  };
  // Where each area is, asked once per process; nothing when the map knows
  // no place by that name. A geocode that failed is asked again next time.
  const areas = new Map<string, Promise<Area | undefined>>();
  const areaOf = (area: string) => {
    const key = letters(area);
    let found = areas.get(key);
    if (!found) {
      found = guarded(() =>
        client.send(
          new GeocodeCommand({
            QueryText: area,
            BiasPosition: home,
            MaxResults: 3,
            IntendedUse: "SingleUse",
            Language: "en",
          }),
        ),
      ).then((out) => {
        const item = (out.ResultItems ?? []).find((i) => isArea(area, i));
        return item?.Position
          ? {
              position: item.Position as Position,
              radiusKm: areaRadiusKm[item.PlaceType!]!,
            }
          : undefined;
      });
      found.catch(() => areas.delete(key));
      areas.set(key, found);
    }
    return found;
  };
  return {
    source: "location",
    async search(name, area) {
      const found = await areaOf(area);
      const out = await guarded(() =>
        client.send(
          new SearchTextCommand({
            QueryText: name,
            BiasPosition: found?.position ?? home,
            MaxResults: 5,
            IntendedUse: "Storage",
            Language: "en",
          }),
        ),
      );
      return (out.ResultItems ?? []).flatMap((item) => {
        if (!item.Title || !venueTypes.has(item.PlaceType ?? "")) return [];
        const address = item.Address;
        const venue: Venue = {
          name: item.Title,
          address: [
            address?.Label,
            address?.Locality,
            address?.District,
            address?.SubDistrict,
            address?.SubRegion?.Name,
            address?.Region?.Name,
            address?.Region?.Code,
            address?.Country?.Name,
          ]
            .filter((part): part is string => !!part)
            .join(" "),
        };
        if (found && item.Position)
          venue.nearArea =
            km(found.position, item.Position as Position) <= found.radiusKm;
        return [venue];
      });
    },
  };
}
