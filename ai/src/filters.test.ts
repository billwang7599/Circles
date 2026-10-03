import type {
  Candidate,
  FilterModes,
  SearchFields,
  TimeWindow,
} from "@circles/shared";
import { describe, expect, test } from "vitest";
import { toSlot } from "./availability.ts";
import {
  applyFilters,
  fitsParty,
  openDuringSlots,
  unverifiedFilters,
  withinArea,
  withinBudget,
} from "./filters.ts";

const place = (over: Partial<Candidate> = {}): Candidate => ({
  id: "p1",
  name: "Place",
  location: { lat: 0, lng: 0 },
  source: "fake",
  ...over,
});
const fields = (over: Partial<SearchFields> = {}): SearchFields => ({
  partySize: 4,
  ...over,
});

// 2026-10-03 is a Saturday. America/New_York is UTC-4 then, so 22:00Z = 18:00 local.
const SAT = 6 * 1440;
const tz = "America/New_York";
const slotAt = (w: TimeWindow) => [toSlot(w, tz)];
const evening = { start: "2026-10-03T22:00:00Z", end: "2026-10-04T00:00:00Z" }; // 18:00-20:00 local
const open = (openH: number, closeH: number) => [
  { openMin: SAT + openH * 60, closeMin: SAT + closeH * 60 },
];

describe("budget", () => {
  test("equal to cap passes, above fails", () => {
    expect(
      withinBudget(place({ priceLevel: 2 }), fields({ maxPriceLevel: 2 })),
    ).toBe(true);
    expect(
      withinBudget(place({ priceLevel: 3 }), fields({ maxPriceLevel: 2 })),
    ).toBe(false);
  });
  test("free place passes a zero cap", () => {
    expect(
      withinBudget(place({ priceLevel: 0 }), fields({ maxPriceLevel: 0 })),
    ).toBe(true);
  });
  test("unknown price passes (fails open)", () => {
    expect(withinBudget(place(), fields({ maxPriceLevel: 2 }))).toBe(true);
    expect(withinBudget(place(), fields())).toBe(true);
  });
});

describe("area", () => {
  // About 1.11 km per 0.01 degree of latitude.
  const near = place({ location: { lat: 0.01, lng: 0 } }); // ~1.1 km from the origin
  const area = (radiusKm: number) => ({ center: { lat: 0, lng: 0 }, radiusKm });

  test("inside the radius passes, outside fails", () => {
    expect(withinArea(near, fields({ area: area(2) }))).toBe(true);
    expect(withinArea(near, fields({ area: area(1) }))).toBe(false);
  });
  test("no area set means no constraint", () => {
    expect(withinArea(near, fields())).toBe(true);
  });
});

describe("open hours against the group's free slots", () => {
  const f = (slots: ReturnType<typeof slotAt>) => fields({ slots });

  test("open for the whole slot passes", () => {
    expect(
      openDuringSlots(
        place({ openingHours: open(11, 22) }),
        f(slotAt(evening)),
      ),
    ).toBe(true);
  });
  test("closed at that time fails", () => {
    expect(
      openDuringSlots(
        place({ openingHours: open(11, 17) }),
        f(slotAt(evening)),
      ),
    ).toBe(false);
  });
  test("closing mid-slot fails", () => {
    expect(
      openDuringSlots(
        place({ openingHours: open(11, 19) }),
        f(slotAt(evening)),
      ),
    ).toBe(false);
  });
  test("exactly covering the slot passes", () => {
    expect(
      openDuringSlots(
        place({ openingHours: open(18, 20) }),
        f(slotAt(evening)),
      ),
    ).toBe(true);
  });
  test("passes if it is open for any one of several slots", () => {
    const morning = {
      start: "2026-10-03T14:00:00Z",
      end: "2026-10-03T16:00:00Z",
    }; // 10:00-12:00
    const slots = [toSlot(morning, tz), toSlot(evening, tz)];
    expect(
      openDuringSlots(place({ openingHours: open(17, 22) }), f(slots)),
    ).toBe(true);
    expect(
      openDuringSlots(place({ openingHours: open(13, 16) }), f(slots)),
    ).toBe(false);
  });
  test("a period wrapping past Saturday midnight covers an early-Sunday slot", () => {
    const hours = [{ openMin: SAT + 18 * 60, closeMin: 7 * 1440 + 2 * 60 }]; // Sat 18:00 to Sun 02:00
    const late = { start: "2026-10-04T05:00:00Z", end: "2026-10-04T06:00:00Z" }; // Sun 01:00-02:00 local
    expect(
      openDuringSlots(place({ openingHours: hours }), f(slotAt(late))),
    ).toBe(true);
  });
  test("unknown hours pass (fails open)", () => {
    expect(openDuringSlots(place(), f(slotAt(evening)))).toBe(true);
  });
  test("no slots set means no constraint; an empty list matches nothing", () => {
    expect(openDuringSlots(place({ openingHours: open(0, 1) }), fields())).toBe(
      true,
    );
    expect(openDuringSlots(place({ openingHours: open(0, 24) }), f([]))).toBe(
      false,
    );
  });
  test("a slot spanning a daylight saving jump is read on the local clock", () => {
    // 2026-03-08 is Sunday; clocks jump 02:00 -> 03:00. This is 01:00 EST to 04:00 EDT.
    const jump = { start: "2026-03-08T06:00:00Z", end: "2026-03-08T08:00:00Z" };
    expect(
      openDuringSlots(
        place({ openingHours: [{ openMin: 0, closeMin: 300 }] }),
        f(slotAt(jump)),
      ),
    ).toBe(true);
    expect(
      openDuringSlots(
        place({ openingHours: [{ openMin: 0, closeMin: 180 }] }),
        f(slotAt(jump)),
      ),
    ).toBe(false);
  });
});

describe("party size", () => {
  test("fits at the limit, fails above, passes when capacity unknown", () => {
    expect(
      fitsParty(place({ maxPartySize: 4 }), fields({ partySize: 4 })),
    ).toBe(true);
    expect(
      fitsParty(place({ maxPartySize: 4 }), fields({ partySize: 5 })),
    ).toBe(false);
    expect(fitsParty(place(), fields({ partySize: 50 }))).toBe(true);
  });
});

const ALL_HARD: FilterModes = {
  budget: "hard",
  openHours: "hard",
  partySize: "hard",
  area: "hard",
};
const prefer = (...names: (keyof FilterModes)[]): FilterModes => ({
  ...ALL_HARD,
  ...Object.fromEntries(names.map((n) => [n, "prefer"])),
});

describe("applyFilters", () => {
  const cands = [
    place({ id: "ok", priceLevel: 1, maxPartySize: 10 }),
    place({ id: "pricey", priceLevel: 4, maxPartySize: 10 }),
    place({ id: "small", priceLevel: 1, maxPartySize: 2 }),
  ];
  const f = fields({ maxPriceLevel: 2, partySize: 6 });

  test("hard filters drop a candidate that fails", () => {
    const r = applyFilters(cands, f, ALL_HARD);
    expect(r.passed.map((c) => c.id)).toEqual(["ok"]);
  });
  test("a preferred filter keeps the candidate and records what it misses", () => {
    const r = applyFilters(cands, f, prefer("budget"));
    expect(r.passed.map((c) => c.id)).toEqual(["ok", "pricey"]);
    expect(r.unmet).toEqual({ ok: [], pricey: ["budget"] });
  });
  test("each filter has its own mode", () => {
    const r = applyFilters(cands, f, prefer("budget", "partySize"));
    expect(r.passed.map((c) => c.id)).toEqual(["ok", "pricey", "small"]);
    expect(r.unmet.small).toEqual(["partySize"]);
    expect(r.unmet.pricey).toEqual(["budget"]);
  });
  test("every filter preferred means nothing is dropped", () => {
    const r = applyFilters(
      cands,
      f,
      prefer("budget", "openHours", "partySize", "area"),
    );
    expect(r.passed).toHaveLength(3);
  });
  test("reports the hard filter that eliminates the most candidates", () => {
    const many = [
      place({ id: "a", priceLevel: 4, maxPartySize: 10 }),
      place({ id: "b", priceLevel: 4, maxPartySize: 10 }),
      place({ id: "c", priceLevel: 1, maxPartySize: 2 }),
    ];
    const r = applyFilters(many, f, ALL_HARD);
    expect(r.passed).toEqual([]);
    expect(r.mostRestrictive).toBe("budget");
    expect(r.rejectedBy).toMatchObject({ budget: 2, partySize: 1 });
  });
  test("a preferred filter is never named as the one that eliminated candidates", () => {
    const r = applyFilters(cands, f, prefer("budget"));
    expect(r.mostRestrictive).toBe("partySize");
  });
  test("nothing rejected leaves mostRestrictive undefined", () => {
    expect(
      applyFilters([place()], fields(), ALL_HARD).mostRestrictive,
    ).toBeUndefined();
  });
});

describe("unverifiedFilters", () => {
  test("lists set constraints that data could not verify", () => {
    expect(
      unverifiedFilters(
        place(),
        fields({ maxPriceLevel: 2, slots: slotAt(evening) }),
      ),
    ).toEqual(["budget", "openHours", "partySize"]);
  });
  test("known data or unset constraints are not listed", () => {
    expect(
      unverifiedFilters(
        place({ priceLevel: 1, openingHours: [], maxPartySize: 8 }),
        fields({ maxPriceLevel: 2, slots: slotAt(evening) }),
      ),
    ).toEqual([]);
    expect(unverifiedFilters(place({ maxPartySize: 8 }), fields())).toEqual([]);
  });
});
