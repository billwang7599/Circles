import { describe, expect, test } from "vitest";
import { mergeIntervals, parseInstant, weekMinutes } from "./time.ts";

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

describe("mergeIntervals", () => {
  const w = (s: number, e: number) => ({
    start: `2026-10-03T${String(s).padStart(2, "0")}:00:00.000Z`,
    end: `2026-10-03T${String(e).padStart(2, "0")}:00:00.000Z`,
  });
  test("merge joins overlapping and touching blocks, sorted", () => {
    expect(
      mergeIntervals([w(14, 16), w(10, 12), w(11, 13), w(13, 14)]),
    ).toEqual([w(10, 16)]);
  });
});
