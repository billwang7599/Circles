import { areaById, type Interval } from "@circles/shared";
import { expect, test } from "vitest";
import { filterPlaces } from "./filters.ts";
import type { FoundPlace, OpeningPeriod } from "./places.ts";

const fridayLunch: Interval = {
  start: "2026-11-06T17:00:00.000Z",
  end: "2026-11-06T19:00:00.000Z",
};
const fridayDinner: Interval = {
  start: "2026-11-06T23:00:00.000Z",
  end: "2026-11-07T01:00:00.000Z",
};
const fridayLate: Interval = {
  start: "2026-11-07T01:00:00.000Z",
  end: "2026-11-07T03:00:00.000Z",
};
const fridayLater: Interval = {
  start: "2026-11-06T23:30:00.000Z",
  end: "2026-11-07T01:30:00.000Z",
};
const saturdayLunch: Interval = {
  start: "2026-11-07T17:00:00.000Z",
  end: "2026-11-07T19:00:00.000Z",
};
const saturdayLater: Interval = {
  start: "2026-11-07T17:30:00.000Z",
  end: "2026-11-07T19:30:00.000Z",
};
const saturdayAfternoon: Interval = {
  start: "2026-11-07T19:00:00.000Z",
  end: "2026-11-07T21:00:00.000Z",
};
const saturdayEvening: Interval = {
  start: "2026-11-07T21:00:00.000Z",
  end: "2026-11-07T23:00:00.000Z",
};

function daily(open: [number, number], close: [number, number]) {
  return [0, 1, 2, 3, 4, 5, 6].map((day): OpeningPeriod => ({
    open: { day, hour: open[0], minute: open[1] },
    close: {
      day: close[0] < open[0] ? (day + 1) % 7 : day,
      hour: close[0],
      minute: close[1],
    },
  }));
}

function place(name: string, extra: Partial<FoundPlace>): FoundPlace {
  return {
    id: `uw-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
    name,
    address: "150 University Ave W, Waterloo, ON",
    lat: 43.4727,
    lng: -80.5376,
    priceLevel: 2,
    rating: 4.2,
    types: ["restaurant"],
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=University+Plaza",
    hours: daily([11, 0], [22, 0]),
    ...extra,
  };
}

const places = [
  place("Kinkaku Izakaya", {
    types: ["japanese_restaurant", "ramen_restaurant", "restaurant"],
    hours: daily([11, 30], [22, 0]),
  }),
  place("Rich Uncle Tavern", { priceLevel: 3 }),
  place("Sweet Dreams Teashop", { priceLevel: undefined }),
  place("Morning Glory Cafe", { hours: daily([7, 0], [11, 0]) }),
  place("Settlement Co.", { hours: daily([7, 30], [15, 0]) }),
  place("Gol's Lanzhou Noodle", { hours: undefined }),
  place("Lazeez Shawarma", { hours: daily([11, 0], [2, 0]) }),
  place("The Yeti Cafe", { lat: 43.4512, lng: -80.4916 }),
];

const input = {
  priceCap: 2,
  slots: [
    fridayDinner,
    fridayLater,
    saturdayLunch,
    saturdayLater,
    saturdayAfternoon,
    saturdayEvening,
  ],
  area: areaById("uw"),
  preferenceTypes: ["japanese_restaurant", "ramen_restaurant"],
};
const { candidates, rejected } = filterPlaces(places, input);
const byName = Object.fromEntries(candidates.map((c) => [c.place.name, c]));

test("known data over the cap, closed for every slot or too far is dropped; matches come first", () => {
  expect(rejected).toEqual({ over_budget: 1, closed: 1, too_far: 1 });
  expect(candidates[0].place.name).toBe("Kinkaku Izakaya");
  expect(candidates[0].matchedPreferences).toBe(2);
  expect(candidates[0].distanceKm).toBe(0.6);
  expect(
    candidates
      .slice(1)
      .map((c) => [c.place.name, c.matchedPreferences])
      .sort(),
  ).toEqual([
    ["Gol's Lanzhou Noodle", 0],
    ["Lazeez Shawarma", 0],
    ["Settlement Co.", 0],
    ["Sweet Dreams Teashop", 0],
  ]);
});

test("unknown price or hours never rejects and is recorded as unverified", () => {
  expect(byName["Sweet Dreams Teashop"].unverified).toEqual(["budget"]);
  expect(byName["Gol's Lanzhou Noodle"].unverified).toEqual(["openHours"]);
  expect(byName["Kinkaku Izakaya"].unverified).toEqual([]);
});

test("times are up to three non-overlapping slots the place is open for, or free slots when hours are unknown", () => {
  for (const name of [
    "Kinkaku Izakaya",
    "Lazeez Shawarma",
    "Gol's Lanzhou Noodle",
  ])
    expect(byName[name].times).toEqual([
      fridayDinner,
      saturdayLunch,
      saturdayAfternoon,
    ]);
  expect(byName["Settlement Co."].times).toEqual([saturdayLunch]);
});

test("times spread across days before a second slot on the same day", () => {
  const dense = [
    fridayLunch,
    fridayDinner,
    fridayLater,
    fridayLate,
    saturdayLunch,
    saturdayLater,
    saturdayAfternoon,
  ];
  const { candidates } = filterPlaces(places, { ...input, slots: dense });
  const kinkaku = candidates.find((c) => c.place.name === "Kinkaku Izakaya");
  expect(kinkaku?.times).toEqual([fridayLunch, fridayDinner, saturdayLunch]);
});
