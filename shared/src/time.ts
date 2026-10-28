import { z } from "zod";

export const When = z.enum(["today", "week", "twoWeeks"]);
export type When = z.infer<typeof When>;

export const Part = z.enum(["morning", "afternoon", "evening"]);
export type Part = z.infer<typeof Part>;

export type Interval = { start: string; end: string };

const windowDays: Record<When, number> = { today: 0, week: 6, twoWeeks: 13 };
const partHours: Record<Part, [number, number]> = {
  morning: [8, 12],
  afternoon: [12, 17],
  evening: [17, 23],
};

function wallClockAsUtc(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(
    field("year"),
    field("month") - 1,
    field("day"),
    field("hour"),
    field("minute"),
    field("second"),
  );
}

function localDate(date: Date, timezone: string): string {
  return new Date(wallClockAsUtc(date, timezone)).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function instantOf(date: string, hour: number, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour);
  let instant = wall;
  for (let i = 0; i < 2; i++) {
    instant = wall - (wallClockAsUtc(new Date(instant), timezone) - instant);
  }
  return new Date(instant);
}

export function windowFor(
  when: When,
  timezone: string,
  now: Date,
): { windowStart: string; windowEnd: string } {
  const windowStart = localDate(now, timezone);
  return { windowStart, windowEnd: addDays(windowStart, windowDays[when]) };
}

export function datesIn(windowStart: string, windowEnd: string): string[] {
  const dates: string[] = [];
  for (let date = windowStart; date <= windowEnd; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function partInterval(
  date: string,
  part: Part,
  timezone: string,
): Interval {
  const [from, to] = partHours[part];
  return {
    start: instantOf(date, from, timezone).toISOString(),
    end: instantOf(date, to, timezone).toISOString(),
  };
}

export function subtractIntervals(
  windows: Interval[],
  busy: Interval[],
): Interval[] {
  return busy.reduce(
    (free, b) =>
      free.flatMap(({ start, end }) => {
        if (b.end <= start || b.start >= end) return [{ start, end }];
        const kept: Interval[] = [];
        if (b.start > start) kept.push({ start, end: b.start });
        if (b.end < end) kept.push({ start: b.end, end });
        return kept;
      }),
    windows,
  );
}
