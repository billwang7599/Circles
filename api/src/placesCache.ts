import type { Db } from "./db.ts";
import { words } from "./plan/itinerary.ts";
import type { Places, Venue } from "./plan/places.ts";

// The venue lookup with a memory: what a map said about a name in an area
// is kept for a month, so remaking an event's options, or two events in the
// same city naming the same spots, asks the map once. Rows are the lookup's
// own, so the fake's answers never serve the real map; only answers are
// kept, and a lookup that failed is asked again; and two options verified
// at once that name the same venue share one request between them.
export const cacheDays = 30;

export function cachedPlaces(db: Db, places: Places): Places {
  const pending = new Map<string, Promise<Venue[]>>();
  const lookup = async (area: string, name: string): Promise<Venue[]> => {
    const key = [places.source, words(area), words(name)];
    const [hit] = await db.query<{ venues: Venue[] }>(
      `select venues from venue_lookups
       where source = $1 and area = $2 and name = $3
         and checked_at > now() - ($4 || ' days')::interval`,
      [...key, String(cacheDays)],
    );
    if (hit) return hit.venues;
    const venues = await places.search(name, area);
    await db.query(
      `insert into venue_lookups (source, area, name, venues, checked_at)
       values ($1, $2, $3, $4::jsonb, now())
       on conflict (source, area, name) do update
         set venues = excluded.venues, checked_at = excluded.checked_at`,
      [...key, JSON.stringify(venues)],
    );
    return venues;
  };
  return {
    source: places.source,
    search(name, area) {
      const id = `${words(area)}|${words(name)}`;
      let run = pending.get(id);
      if (!run) {
        run = lookup(area, name).finally(() => pending.delete(id));
        pending.set(id, run);
      }
      return run;
    },
  };
}
