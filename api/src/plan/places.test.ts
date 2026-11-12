import { GeocodeCommand, SearchTextCommand } from "@aws-sdk/client-geo-places";
import { expect, test } from "vitest";
import {
  fakePlaces,
  locationPlaces,
  type LocationClient,
  type Position,
} from "./places.ts";

test("the fake knows a resort, a park or a market anywhere, and nothing else", async () => {
  const places = fakePlaces();
  expect(await places.search("Deerhurst Resort", "Muskoka")).toEqual([
    { name: "Deerhurst Resort", address: "Muskoka" },
  ]);
  expect(await places.search("St. Lawrence market", "Toronto")).toHaveLength(1);
  expect(await places.search("High Park", "Toronto")).toHaveLength(1);
  expect(await places.search("Kinton Ramen", "Toronto")).toEqual([]);
});

const home: Position = [-79.38, 43.65];
const toronto: Position = [-79.3832, 43.6532];

const torontoCity = {
  PlaceType: "Locality",
  Title: "Toronto",
  Address: { Label: "Toronto, ON, Canada" },
  Position: toronto,
};

const kinton = {
  PlaceType: "PointOfInterest",
  Title: "Kinton Ramen",
  Address: {
    Label: "Kinton Ramen, 51 Baldwin St, Toronto, ON M5T 1L1, Canada",
    Locality: "Toronto",
    District: "Kensington-Chinatown",
    SubRegion: { Name: "Toronto" },
    Region: { Code: "ON", Name: "Ontario" },
    Country: { Name: "Canada" },
  },
  Position: [-79.3947, 43.6559],
};

// Amazon Location as it answers a geocode and a text search, and what was
// asked of it.
function location(
  geocoded: Record<string, unknown[]>,
  found: Record<string, unknown[]>,
) {
  const sent: (GeocodeCommand | SearchTextCommand)[] = [];
  const client = {
    async send(command: GeocodeCommand | SearchTextCommand) {
      sent.push(command);
      const table = command instanceof GeocodeCommand ? geocoded : found;
      return { ResultItems: table[command.input.QueryText ?? ""] ?? [] };
    },
  } as unknown as LocationClient;
  return { sent, client };
}

test("a lookup finds the area once, searches each name near it and says whether the venues lie within it", async () => {
  const { sent, client } = location(
    {
      // A shop that borrowed the name comes first; the city is the area.
      Toronto: [
        {
          PlaceType: "PointOfInterest",
          Title: "Toronto Eaton Centre",
          Address: { Label: "220 Yonge St, Toronto, ON, Canada" },
          Position: toronto,
        },
        torontoCity,
      ],
    },
    {
      "Kinton Ramen": [
        kinton,
        // The same name on the other coast.
        {
          PlaceType: "PointOfInterest",
          Title: "Kinton Ramen",
          Address: { Label: "Kinton Ramen, Vancouver, BC, Canada" },
          Position: [-123.1207, 49.2827],
        },
        // Not a venue: the neighbourhood.
        {
          PlaceType: "District",
          Title: "Chinatown",
          Address: { Label: "Chinatown, Toronto, ON, Canada" },
        },
        // Nothing to go by.
        { PlaceType: "PointOfInterest" },
      ],
    },
  );
  const places = locationPlaces("ca-central-1", 30, home, client);
  expect(places.source).toBe("location");
  expect(await places.search("Kinton Ramen", "Toronto")).toEqual([
    {
      name: "Kinton Ramen",
      address:
        "Kinton Ramen, 51 Baldwin St, Toronto, ON M5T 1L1, Canada Toronto Kensington-Chinatown Toronto Ontario ON Canada",
      nearArea: true,
    },
    {
      name: "Kinton Ramen",
      address: "Kinton Ramen, Vancouver, BC, Canada",
      nearArea: false,
    },
  ]);
  expect(await places.search("Ramen Alley", "toronto")).toEqual([]);
  // One geocode for the area, then one search per name, biased to it.
  expect(sent.map((c) => c.constructor.name)).toEqual([
    "GeocodeCommand",
    "SearchTextCommand",
    "SearchTextCommand",
  ]);
  expect(sent[0]!.input).toEqual({
    QueryText: "Toronto",
    BiasPosition: home,
    MaxResults: 3,
    IntendedUse: "SingleUse",
    Language: "en",
  });
  // Searches are kept for a month, so they are requested for storage.
  expect(sent[1]!.input).toEqual({
    QueryText: "Kinton Ramen",
    BiasPosition: toronto,
    MaxResults: 5,
    IntendedUse: "Storage",
    Language: "en",
  });
});

test("an area the map knows only as a shop, or not at all, is searched from home and says nothing about nearness", async () => {
  const { sent, client } = location(
    {
      "Blue Mountain": [
        {
          PlaceType: "PointOfInterest",
          Title: "Blue Mountain",
          Address: { Label: "Blue Mountain, 8 Simmons Blvd, Brampton, ON" },
          Position: [-79.76, 43.7],
        },
      ],
    },
    {
      "Blue Mountain Resort": [
        {
          PlaceType: "PointOfInterest",
          Title: "Blue Mountain Resort",
          Address: { Label: "190 Gord Canning Dr, Blue Mountains, ON" },
          Position: [-80.31, 44.5],
        },
      ],
    },
  );
  const places = locationPlaces("ca-central-1", 30, home, client);
  expect(await places.search("Blue Mountain Resort", "Blue Mountain")).toEqual([
    {
      name: "Blue Mountain Resort",
      address: "190 Gord Canning Dr, Blue Mountains, ON",
    },
  ]);
  expect(await places.search("Anything", "Atlantis")).toEqual([]);
  expect(sent.map((c) => c.input.BiasPosition)).toEqual([
    home,
    home,
    home,
    home,
  ]);
});

test("a refusal throws with the service's word for it, and past the cap nothing is sent", async () => {
  const refused = {
    async send() {
      throw Object.assign(new Error("not authorized"), {
        name: "AccessDeniedException",
      });
    },
  } as unknown as LocationClient;
  await expect(
    locationPlaces("ca-central-1", 30, home, refused).search(
      "Kinton Ramen",
      "Toronto",
    ),
  ).rejects.toThrow(
    /Amazon Location answered AccessDeniedException: not authorized/,
  );

  const { sent, client } = location(
    { Toronto: [torontoCity] },
    { "Kinton Ramen": [kinton] },
  );
  const capped = locationPlaces("ca-central-1", 2, home, client);
  // The geocode and the first search spend the cap.
  expect(await capped.search("Kinton Ramen", "Toronto")).toHaveLength(1);
  await expect(capped.search("Kinton Ramen", "Toronto")).rejects.toThrow(
    /capped at 2/,
  );
  expect(sent).toHaveLength(2);
});
