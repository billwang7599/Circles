import { z } from "zod";

export const When = z.enum(["today", "week", "twoWeeks"]);
export type When = z.infer<typeof When>;

export const Part = z.enum(["morning", "afternoon", "evening"]);
export type Part = z.infer<typeof Part>;

export type Interval = { start: string; end: string };

// The quick picks offered next to the calendar when starting a plan.
export const Preset = z.enum([
  "today",
  "tomorrow",
  "weekend",
  "week",
  "twoWeeks",
]);
export type Preset = z.infer<typeof Preset>;

// A window ends at most this many days after it starts, so 15 days in all.
export const maxWindowDays = 14;

const windowDays: Record<When, number> = { today: 0, week: 6, twoWeeks: 13 };
export const partHours: Record<Part, [number, number]> = {
  morning: [8, 12],
  afternoon: [12, 17],
  evening: [17, 23],
};

const wallClockFormats = new Map<string, Intl.DateTimeFormat>();

function wallClockFormat(timezone: string): Intl.DateTimeFormat {
  let format = wallClockFormats.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    wallClockFormats.set(timezone, format);
  }
  return format;
}

export function wallClockAsUtc(date: Date, timezone: string): number {
  const parts = wallClockFormat(timezone).formatToParts(date);
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

export function localDate(date: Date, timezone: string): string {
  return new Date(wallClockAsUtc(date, timezone)).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function instantOf(date: string, hour: number, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
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

export function presetWindow(
  preset: Preset,
  timezone: string,
  now: Date,
): { windowStart: string; windowEnd: string } {
  const today = localDate(now, timezone);
  const span = (from: number, to: number) => ({
    windowStart: addDays(today, from),
    windowEnd: addDays(today, to),
  });
  switch (preset) {
    case "today":
      return span(0, 0);
    case "tomorrow":
      return span(1, 1);
    case "weekend": {
      // The coming Saturday and Sunday, or what is left of this weekend.
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      if (weekday === 0) return span(0, 0);
      return span(6 - weekday, 7 - weekday);
    }
    case "week":
      return span(0, 6);
    case "twoWeeks":
      return span(0, 13);
  }
}

// Days between two YYYY-MM-DD dates, positive when `to` is later.
export function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

// Each day's chosen parts as intervals, with touching parts joined so a slot
// can run from the afternoon into the evening.
export function partIntervals(
  date: string,
  parts: Part[],
  timezone: string,
): Interval[] {
  return Part.options
    .filter((part) => parts.includes(part))
    .map((part) => partInterval(date, part, timezone))
    .reduce<Interval[]>((joined, next) => {
      const last = joined.at(-1);
      if (last && last.end === next.start) last.end = next.end;
      else joined.push({ ...next });
      return joined;
    }, []);
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
