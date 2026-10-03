import type { Candidate } from "@circles/shared";
import { describe, expect, test } from "vitest";
import {
  availableTimes,
  filterSlotsByWhen,
  generateSlots,
  openCovers,
  slotOptionsForWhen,
  toSlot,
} from "./availability.ts";

const tz = "America/Toronto"; // UTC-4 in early October
// Saturday 2026-10-03, local 00:00 = 04:00Z
const free = (startLocal: string, endLocal: string) => ({
  start: `2026-10-03T${startLocal}:00Z`,
  end: `2026-10-03T${endLocal}:00Z`,
});

describe("toSlot", () => {
  test("fills in local week-minutes", () => {
    const s = toSlot(free("22:00", "23:59"), tz); // 18:00 Saturday local
    expect(s.startMin).toBe(6 * 1440 + 18 * 60);
    expect(s.endMin).toBeGreaterThan(s.startMin);
  });
  test("a slot crossing local midnight on Saturday ends past the week", () => {
    const s = toSlot(
      { start: "2026-10-04T02:00:00Z", end: "2026-10-04T05:00:00Z" },
      tz,
    ); // Sat 22:00 to Sun 01:00
    expect(s.endMin).toBeGreaterThan(7 * 1440);
  });
});

describe("generateSlots", () => {
  test("steps through a free window and only keeps slots that fit inside it", () => {
    // Free 22:00Z-02:00Z next day = 18:00-22:00 local; 2h slots every 30 min start at 18:00..20:00
    const slots = generateSlots(
      [{ start: "2026-10-03T22:00:00Z", end: "2026-10-04T02:00:00Z" }],
      tz,
    );
    expect(slots.map((s) => s.start)).toEqual([
      "2026-10-03T22:00:00.000Z",
      "2026-10-03T22:30:00.000Z",
      "2026-10-03T23:00:00.000Z",
      "2026-10-03T23:30:00.000Z",
      "2026-10-04T00:00:00.000Z",
    ]);
    expect(slots.at(-1)!.end).toBe("2026-10-04T02:00:00.000Z");
  });
  test("a window shorter than the meeting gives nothing", () => {
    expect(
      generateSlots(
        [{ start: "2026-10-03T22:00:00Z", end: "2026-10-03T23:30:00Z" }],
        tz,
      ),
    ).toEqual([]);
  });
  test("drops slots that start outside the allowed local hours", () => {
    // Whole Saturday local: 04:00Z to 04:00Z next day. Default hours are 11:00-21:00 local.
    const slots = generateSlots(
      [{ start: "2026-10-03T04:00:00Z", end: "2026-10-04T04:00:00Z" }],
      tz,
    );
    const hours = slots.map((s) => (s.startMin % 1440) / 60);
    expect(Math.min(...hours)).toBe(11);
    expect(Math.max(...hours)).toBe(21);
  });
  test("honours custom duration, step and hours", () => {
    const slots = generateSlots(
      [{ start: "2026-10-03T22:00:00Z", end: "2026-10-04T00:00:00Z" }],
      tz,
      { durationMin: 60, stepMin: 60, earliestHour: 0, latestStartHour: 23 },
    );
    expect(slots).toHaveLength(2);
  });
  test("no free windows gives no slots", () => {
    expect(generateSlots([], tz)).toEqual([]);
  });
});

describe("openCovers and availableTimes", () => {
  const SAT = 6 * 1440;
  const hours = [{ openMin: SAT + 17 * 60, closeMin: SAT + 21 * 60 }]; // Sat 17:00-21:00 local
  const slots = generateSlots(
    [{ start: "2026-10-03T15:00:00Z", end: "2026-10-04T04:00:00Z" }],
    tz,
  ); // 11:00 Sat to midnight
  const candidate = (over: Partial<Candidate>): Candidate => ({
    id: "c",
    name: "C",
    location: { lat: 0, lng: 0 },
    source: "t",
    ...over,
  });

  test("openCovers needs the place open for the whole slot", () => {
    expect(
      openCovers(
        hours,
        toSlot(
          { start: "2026-10-03T21:00:00Z", end: "2026-10-03T23:00:00Z" },
          tz,
        ),
      ),
    ).toBe(true); // 17:00-19:00
    expect(
      openCovers(
        hours,
        toSlot(
          { start: "2026-10-03T23:30:00Z", end: "2026-10-04T01:30:00Z" },
          tz,
        ),
      ),
    ).toBe(false); // 19:30-21:30
  });
  test("availableTimes merges contiguous open slots into one stretch", () => {
    const times = availableTimes(candidate({ openingHours: hours }), slots);
    expect(times).toEqual([
      { start: "2026-10-03T21:00:00.000Z", end: "2026-10-04T01:00:00.000Z" },
    ]); // 17:00-21:00 local
  });
  test("a place never open when the group is free has no times", () => {
    expect(
      availableTimes(
        candidate({ openingHours: [{ openMin: SAT, closeMin: SAT + 600 }] }),
        slots,
      ),
    ).toEqual([]);
  });
  test("unknown hours give no times rather than guessing", () => {
    expect(availableTimes(candidate({}), slots)).toEqual([]);
  });
  test("returns at most maxRanges stretches, earliest first", () => {
    const week = generateSlots(
      [{ start: "2026-10-03T15:00:00Z", end: "2026-10-10T04:00:00Z" }],
      tz,
    );
    const daily = Array.from({ length: 7 }, (_, d) => ({
      openMin: d * 1440 + 17 * 60,
      closeMin: d * 1440 + 21 * 60,
    }));
    const times = availableTimes(candidate({ openingHours: daily }), week, 3);
    expect(times).toHaveLength(3);
    expect(times[0]!.start < times[1]!.start).toBe(true);
  });
});

describe("filterSlotsByWhen", () => {
  // The whole of Fri 2026-10-02 to Mon 2026-10-05 local (Toronto, UTC-4), with slots 08:00-21:00.
  const free = [{ start: "2026-10-02T04:00:00Z", end: "2026-10-06T04:00:00Z" }];
  const slots = generateSlots(free, tz, {
    earliestHour: 8,
    latestStartHour: 21,
  });
  const now = new Date("2026-10-02T15:00:00Z"); // Friday 11:00 local
  const days = (when: Parameters<typeof filterSlotsByWhen>[1]) =>
    new Set(
      filterSlotsByWhen(slots, when, tz, now).map((s) =>
        Math.floor(s.startMin / 1440),
      ),
    );

  test("no when keeps everything", () => {
    expect(filterSlotsByWhen(slots, undefined, tz, now)).toEqual(slots);
    expect(
      filterSlotsByWhen(slots, { days: [], partsOfDay: [] }, tz, now),
    ).toEqual(slots);
  });
  test("a weekday name keeps only that day", () => {
    expect(days({ days: ["sunday"] })).toEqual(new Set([0]));
    expect(days({ days: ["saturday", "monday"] })).toEqual(new Set([6, 1]));
  });
  test("today and tomorrow are resolved from the clock in the zone", () => {
    expect(days({ days: ["today"] })).toEqual(new Set([5])); // Friday
    expect(days({ days: ["tomorrow"] })).toEqual(new Set([6])); // Saturday
  });
  test("weekend and weekdays", () => {
    expect(days({ days: ["weekend"] })).toEqual(new Set([6, 0]));
    expect(days({ days: ["weekdays"] })).toEqual(new Set([5, 1]));
  });
  test("parts of the day keep only slots starting in those hours", () => {
    const evening = filterSlotsByWhen(
      slots,
      { partsOfDay: ["evening"] },
      tz,
      now,
    );
    const hours = evening.map((s) => Math.floor((s.startMin % 1440) / 60));
    expect(Math.min(...hours)).toBe(17);
    expect(Math.max(...hours)).toBe(21);
    const morning = filterSlotsByWhen(
      slots,
      { partsOfDay: ["morning"] },
      tz,
      now,
    );
    expect(
      Math.max(...morning.map((s) => Math.floor((s.startMin % 1440) / 60))),
    ).toBe(11);
  });
  test("days and parts combine", () => {
    const r = filterSlotsByWhen(
      slots,
      { days: ["sunday"], partsOfDay: ["evening"] },
      tz,
      now,
    );
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => Math.floor(s.startMin / 1440) === 0)).toBe(true);
  });
  test("'tomorrow' follows the zone, not UTC", () => {
    // 23:30 Friday local is already Saturday in UTC. Tomorrow is still Saturday local.
    const lateNow = new Date("2026-10-03T03:30:00Z");
    const r = filterSlotsByWhen(slots, { days: ["tomorrow"] }, tz, lateNow);
    expect(new Set(r.map((s) => Math.floor(s.startMin / 1440)))).toEqual(
      new Set([6]),
    );
  });
});

describe("slotOptionsForWhen", () => {
  test("no parts of the day means the defaults", () => {
    expect(slotOptionsForWhen(undefined)).toEqual({});
    expect(slotOptionsForWhen({ days: ["sunday"] })).toEqual({});
  });
  test("asking for mornings widens the hours before the default 11:00", () => {
    expect(slotOptionsForWhen({ partsOfDay: ["morning"] })).toEqual({
      earliestHour: 8,
      latestStartHour: 11,
    });
    expect(slotOptionsForWhen({ partsOfDay: ["morning", "evening"] })).toEqual({
      earliestHour: 8,
      latestStartHour: 21,
    });
  });
});
