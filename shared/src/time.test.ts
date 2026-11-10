import { expect, test } from "vitest";
import {
  approxRange,
  dayRange,
  exactRange,
  hasEnded,
  presetWindow,
  type Preset,
} from "./time.ts";

test("an event has ended once its last day is over everywhere", () => {
  const end = "2026-12-14";
  expect(hasEnded(end, new Date("2026-12-14T23:59:00Z"))).toBe(false);
  expect(hasEnded(end, new Date("2026-12-15T11:59:59Z"))).toBe(false);
  expect(hasEnded(end, new Date("2026-12-15T12:00:00Z"))).toBe(true);
  expect(hasEnded(end, new Date("2027-01-01T00:00:00Z"))).toBe(true);
});

const window = (preset: Preset, today: string) => {
  const { windowStart, windowEnd } = presetWindow(preset, today);
  return `${windowStart} ${windowEnd}`;
};

test("quick picks are whole weekends, weeks and months after today", () => {
  // A Monday.
  const monday = "2026-11-09";
  expect(window("thisWeekend", monday)).toBe("2026-11-14 2026-11-15");
  expect(window("nextWeek", monday)).toBe("2026-11-16 2026-11-22");
  expect(window("nextTwoWeeks", monday)).toBe("2026-11-16 2026-11-29");
  expect(window("nextMonth", monday)).toBe("2026-12-01 2026-12-31");
  expect(window("nextTwoMonths", monday)).toBe("2026-12-01 2027-01-31");

  expect(window("thisWeekend", "2026-11-14")).toBe("2026-11-14 2026-11-15");
  expect(window("thisWeekend", "2026-11-15")).toBe("2026-11-15 2026-11-15");
  expect(window("nextWeek", "2026-11-15")).toBe("2026-11-16 2026-11-22");
  expect(window("nextMonth", "2027-01-31")).toBe("2027-02-01 2027-02-28");
});

test("ranges read as days, exact dates, or months for a long window", () => {
  expect(dayRange("2026-12-11", "2026-12-11")).toBe("Dec 11");
  expect(dayRange("2026-12-11", "2026-12-14")).toBe("Dec 11 – 14");
  expect(dayRange("2026-12-27", "2027-01-02")).toBe("Dec 27 – Jan 2");

  expect(exactRange("2026-11-14", "2026-11-15")).toBe("Nov 14 – 15, 2026");
  expect(exactRange("2026-12-01", "2027-01-31")).toBe(
    "Dec 1, 2026 – Jan 31, 2027",
  );

  expect(approxRange("2026-12-01", "2027-01-31")).toBe("Dec – Jan");
  expect(approxRange("2026-12-01", "2027-01-31", true)).toBe(
    "Dec 2026 – Jan 2027",
  );
  expect(approxRange("2026-12-01", "2026-12-31")).toBe("Dec");
  expect(approxRange("2026-11-14", "2026-11-15")).toBe("Nov 14 – 15");
  expect(approxRange("2026-11-14", "2026-11-15", true)).toBe(
    "Nov 14 – 15, 2026",
  );
});
