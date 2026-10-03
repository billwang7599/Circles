import { describe, expect, test } from "vitest";
import {
  intersect,
  intersectAll,
  makeInterval,
  mergeIntervals,
  subtractIntervals,
  overlaps,
  parseInstant,
  weekMinutes,
  zonedToUtc,
} from "./time.ts";

const tz = "America/New_York";

describe("parseInstant", () => {
  test("accepts UTC ISO strings", () => {
    expect(parseInstant("2026-10-03T22:00:00Z")).toBe(Date.UTC(2026, 9, 3, 22));
    expect(parseInstant("2026-10-03T22:00Z")).toBe(Date.UTC(2026, 9, 3, 22));
  });
  test("rejects offsets, local times, date-only, and impossible dates", () => {
    for (const bad of [
      "2026-10-03T18:00:00-04:00",
      "2026-10-03T22:00:00",
      "2026-10-03",
      "2026-13-40T00:00:00Z",
      "nonsense",
    ]) {
      expect(() => parseInstant(bad)).toThrow();
    }
  });
});

describe("intervals", () => {
  const a = makeInterval("2026-10-03T18:00:00Z", "2026-10-03T20:00:00Z");
  const b = makeInterval("2026-10-03T20:00:00Z", "2026-10-03T22:00:00Z");
  const c = makeInterval("2026-10-03T19:00:00Z", "2026-10-03T21:00:00Z");

  test("makeInterval rejects empty and inverted intervals", () => {
    expect(() => makeInterval(a.start, a.start)).toThrow();
    expect(() => makeInterval(a.end, a.start)).toThrow();
  });
  test("half-open: touching intervals do not overlap", () => {
    expect(overlaps(a, b)).toBe(false);
    expect(intersect(a, b)).toBeUndefined();
  });
  test("intersect returns the shared span", () => {
    expect(intersect(a, c)).toEqual({
      start: "2026-10-03T19:00:00.000Z",
      end: "2026-10-03T20:00:00.000Z",
    });
  });
  test("intersectAll across two members' free time", () => {
    expect(intersectAll([a, b], [c])).toEqual([
      { start: "2026-10-03T19:00:00.000Z", end: "2026-10-03T20:00:00.000Z" },
      { start: "2026-10-03T20:00:00.000Z", end: "2026-10-03T21:00:00.000Z" },
    ]);
  });
});

describe("weekMinutes and daylight saving", () => {
  test("spring forward 2026-03-08: 06:59Z is 01:59 EST, 07:00Z is 03:00 EDT", () => {
    const sun = 0;
    expect(weekMinutes("2026-03-08T06:59:00Z", tz)).toBe(sun + 60 + 59);
    expect(weekMinutes("2026-03-08T07:00:00Z", tz)).toBe(sun + 3 * 60);
  });
  test("fall back 2026-11-01: 01:30 local happens twice, same week-minute", () => {
    expect(weekMinutes("2026-11-01T05:30:00Z", tz)).toBe(90);
    expect(weekMinutes("2026-11-01T06:30:00Z", tz)).toBe(90);
  });
});

describe("mergeIntervals and subtractIntervals", () => {
  const w = (s: number, e: number) => ({
    start: `2026-10-03T${String(s).padStart(2, "0")}:00:00.000Z`,
    end: `2026-10-03T${String(e).padStart(2, "0")}:00:00.000Z`,
  });
  test("merge joins overlapping and touching blocks, sorted", () => {
    expect(
      mergeIntervals([w(14, 16), w(10, 12), w(11, 13), w(13, 14)]),
    ).toEqual([w(10, 16)]);
  });
  test("subtract removes blocks from the range", () => {
    expect(subtractIntervals(w(9, 18), [w(11, 12), w(14, 15)])).toEqual([
      w(9, 11),
      w(12, 14),
      w(15, 18),
    ]);
  });
  test("subtract clips blocks that extend past the range and ignores ones outside", () => {
    expect(subtractIntervals(w(9, 18), [w(7, 10), w(17, 20), w(0, 1)])).toEqual(
      [w(10, 17)],
    );
  });
  test("subtract with no blocks returns the range; fully blocked returns nothing", () => {
    expect(subtractIntervals(w(9, 18), [])).toEqual([w(9, 18)]);
    expect(subtractIntervals(w(9, 18), [w(8, 19)])).toEqual([]);
  });
});

describe("zonedToUtc", () => {
  test("converts a wall-clock time in a zone to UTC", () => {
    expect(zonedToUtc("2026-10-03T18:00", "America/Toronto")).toBe(
      "2026-10-03T22:00:00.000Z",
    ); // EDT, UTC-4
    expect(zonedToUtc("2026-01-15T18:00", "America/Toronto")).toBe(
      "2026-01-15T23:00:00.000Z",
    ); // EST, UTC-5
    expect(zonedToUtc("2026-10-03T18:00", "America/Vancouver")).toBe(
      "2026-10-04T01:00:00.000Z",
    );
    expect(zonedToUtc("2026-10-03T12:00", "Asia/Kolkata")).toBe(
      "2026-10-03T06:30:00.000Z",
    ); // UTC+5:30
    expect(zonedToUtc("2026-10-03T12:00", "UTC")).toBe(
      "2026-10-03T12:00:00.000Z",
    );
  });
  test("two people entering the same wall time in different zones get different instants", () => {
    const toronto = zonedToUtc("2026-10-03T18:00", "America/Toronto");
    const vancouver = zonedToUtc("2026-10-03T18:00", "America/Vancouver");
    expect(Date.parse(vancouver) - Date.parse(toronto)).toBe(3 * 3600_000);
  });
  test("round-trips through weekMinutes", () => {
    const iso = zonedToUtc("2026-10-03T18:00", "America/Toronto");
    expect(weekMinutes(iso, "America/Toronto")).toBe(6 * 1440 + 18 * 60);
  });
  test("daylight saving edges resolve to a real instant", () => {
    // 02:30 does not exist on 2026-03-08 in Toronto; 01:30 happens twice on 2026-11-01.
    const gap = Date.parse(zonedToUtc("2026-03-08T02:30", "America/Toronto"));
    expect([
      Date.parse("2026-03-08T06:30:00Z"),
      Date.parse("2026-03-08T07:30:00Z"),
    ]).toContain(gap);
    const twice = Date.parse(zonedToUtc("2026-11-01T01:30", "America/Toronto"));
    expect([
      Date.parse("2026-11-01T05:30:00Z"),
      Date.parse("2026-11-01T06:30:00Z"),
    ]).toContain(twice);
  });
  test("rejects anything that is not a local date-time", () => {
    expect(() => zonedToUtc("2026-10-03T18:00:00Z", "UTC")).toThrow();
    expect(() => zonedToUtc("tomorrow", "UTC")).toThrow();
  });
});
