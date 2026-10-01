import type { User } from "@circles/ai";

const HOUR = 3600_000;

/** Block starting `days` from today at `hour` local time, lasting `hours`, as UTC instants. */
function block(days: number, hour: number, hours: number) {
  const start = new Date();
  start.setDate(start.getDate() + days);
  start.setHours(hour, 0, 0, 0);
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + hours * HOUR).toISOString(),
  };
}

/** Fresh sample users with new ids, for trying the app without typing data in. */
export function makeSampleUsers(): User[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "Alex",
      budget: 20,
      maxDistanceKm: 5,
      unavailable: [block(1, 9, 8), block(2, 18, 3)],
    },
    {
      id: crypto.randomUUID(),
      name: "Sam",
      budget: 40,
      maxDistanceKm: 10,
      unavailable: [block(2, 12, 6)],
    },
    {
      id: crypto.randomUUID(),
      name: "Jordan",
      budget: 30,
      maxDistanceKm: 3,
      unavailable: [],
    },
    {
      id: crypto.randomUUID(),
      name: "Riley",
      budget: 15,
      maxDistanceKm: 8,
      unavailable: [block(3, 17, 4)],
    },
  ];
}
