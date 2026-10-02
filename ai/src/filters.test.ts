import { describe, expect, test } from "vitest";
import {
  applyFilters,
  openDuringWindow as openRaw,
  withinBudget as budgetRaw,
  fitsParty as partyRaw,
  unverifiedFilters,
  type Filter,
} from "./filters.ts";
import { weekMinutes } from "@circles/shared";
import type { Candidate, SearchFields } from "@circles/shared";

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
const window = { start: "2026-10-03T22:00:00Z", end: "2026-10-04T00:00:00Z" }; // 18:00-20:00 local
const tz = "America/New_York";
const ctx = { timezone: tz };
// Filters with the default timezone bound, so cases read without repeating it.
const bind =
  (f: Filter) =>
  (c: Candidate, fl: SearchFields, x = ctx) =>
    f(c, fl, x);
const withinBudget = bind(budgetRaw);
const fitsParty = bind(partyRaw);
const openDuringWindow = bind(openRaw);

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

describe("weekMinutes", () => {
  test("reads the instant in the given zone", () => {
    expect(weekMinutes("2026-10-03T22:00:00Z", tz)).toBe(SAT + 18 * 60);
  });
});

describe("open hours", () => {
  const open = (openH: number, closeH: number) => [
    { openMin: SAT + openH * 60, closeMin: SAT + closeH * 60 },
  ];
  test("open for the whole window passes", () => {
    expect(
      openDuringWindow(
        place({ openingHours: open(11, 22) }),
        fields({ window }),
        ctx,
      ),
    ).toBe(true);
  });
  test("closed at that time fails", () => {
    expect(
      openDuringWindow(
        place({ openingHours: open(11, 17) }),
        fields({ window }),
        ctx,
      ),
    ).toBe(false);
  });
  test("closing mid-window fails", () => {
    expect(
      openDuringWindow(
        place({ openingHours: open(11, 19) }),
        fields({ window }),
        ctx,
      ),
    ).toBe(false);
  });
  test("exactly covering the window passes", () => {
    expect(
      openDuringWindow(
        place({ openingHours: open(18, 20) }),
        fields({ window }),
        ctx,
      ),
    ).toBe(true);
  });
  test("period wrapping past Saturday midnight covers an early-Sunday window", () => {
    const hours = [{ openMin: SAT + 18 * 60, closeMin: 7 * 1440 + 2 * 60 }]; // Sat 18:00 to Sun 02:00
    const lateWindow = {
      start: "2026-10-04T05:00:00Z",
      end: "2026-10-04T06:00:00Z",
    }; // Sun 01:00-02:00 local
    expect(
      openDuringWindow(
        place({ openingHours: hours }),
        fields({ window: lateWindow }),
        ctx,
      ),
    ).toBe(true);
  });
  test("unknown hours pass, but an invalid timezone fails", () => {
    expect(openDuringWindow(place(), fields({ window }), ctx)).toBe(true);
    expect(
      openDuringWindow(
        place({ openingHours: open(0, 24) }),
        fields({ window }),
        { timezone: "Not/AZone" },
      ),
    ).toBe(false);
  });
  test("no window means no constraint", () => {
    expect(openDuringWindow(place(), fields(), ctx)).toBe(true);
  });
  test("empty or inverted window fails", () => {
    const bad = { start: window.end, end: window.start };
    expect(
      openDuringWindow(
        place({ openingHours: open(0, 24) }),
        fields({ window: bad }),
        ctx,
      ),
    ).toBe(false);
  });
});

describe("party size", () => {
  test("fits at the limit, fails above, passes when capacity unknown", () => {
    expect(
      fitsParty(place({ maxPartySize: 4 }), fields({ partySize: 4 }), ctx),
    ).toBe(true);
    expect(
      fitsParty(place({ maxPartySize: 4 }), fields({ partySize: 5 }), ctx),
    ).toBe(false);
    expect(fitsParty(place(), fields({ partySize: 50 }), ctx)).toBe(true);
  });
});

describe("applyFilters", () => {
  test("keeps only candidates passing every filter", () => {
    const cands = [
      place({ id: "ok", priceLevel: 1, maxPartySize: 10 }),
      place({ id: "pricey", priceLevel: 4, maxPartySize: 10 }),
      place({ id: "small", priceLevel: 1, maxPartySize: 2 }),
    ];
    const r = applyFilters(
      cands,
      fields({ maxPriceLevel: 2, partySize: 6 }),
      ctx,
    );
    expect(r.passed.map((c) => c.id)).toEqual(["ok"]);
  });
  test("reports the filter that eliminates the most candidates", () => {
    const cands = [
      place({ id: "a", priceLevel: 4, maxPartySize: 10 }),
      place({ id: "b", priceLevel: 4, maxPartySize: 10 }),
      place({ id: "c", priceLevel: 1, maxPartySize: 2 }),
    ];
    const r = applyFilters(
      cands,
      fields({ maxPriceLevel: 2, partySize: 6 }),
      ctx,
    );
    expect(r.passed).toEqual([]);
    expect(r.mostRestrictive).toBe("budget");
    expect(r.rejectedBy).toMatchObject({ budget: 2, partySize: 1 });
  });
  test("nothing rejected leaves mostRestrictive undefined", () => {
    expect(
      applyFilters([place()], fields(), ctx).mostRestrictive,
    ).toBeUndefined();
  });
});

describe("open hours across daylight saving", () => {
  // 2026-03-08 is Sunday; clocks jump 02:00 -> 03:00 EST->EDT.
  test("a window spanning the jump is read on the local clock", () => {
    const w = { start: "2026-03-08T06:00:00Z", end: "2026-03-08T08:00:00Z" }; // 01:00 EST - 04:00 EDT
    const open = [{ openMin: 0, closeMin: 5 * 60 }];
    expect(
      openDuringWindow(place({ openingHours: open }), fields({ window: w })),
    ).toBe(true);
    const closesAtThree = [{ openMin: 0, closeMin: 3 * 60 }];
    expect(
      openDuringWindow(
        place({ openingHours: closesAtThree }),
        fields({ window: w }),
      ),
    ).toBe(false);
  });
});

describe("unverifiedFilters", () => {
  test("lists set constraints that data could not verify", () => {
    expect(
      unverifiedFilters(place(), fields({ maxPriceLevel: 2, window })),
    ).toEqual(["budget", "openHours", "partySize"]);
  });
  test("known data or unset constraints are not listed", () => {
    expect(
      unverifiedFilters(
        place({ priceLevel: 1, openingHours: [], maxPartySize: 8 }),
        fields({ maxPriceLevel: 2, window }),
      ),
    ).toEqual([]);
    expect(unverifiedFilters(place({ maxPartySize: 8 }), fields())).toEqual([]);
  });
});
