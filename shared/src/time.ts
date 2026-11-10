import { z } from "zod";

// A calendar day, YYYY-MM-DD.
export const IsoDate = z.iso.date();

// A window ends at most this many days after it starts, so 90 days in all:
// room for a trip planned a season out.
export const maxWindowDays = 89;

// The quick picks offered when starting an event.
export const Preset = z.enum([
  "thisWeekend",
  "nextWeek",
  "nextTwoWeeks",
  "nextMonth",
  "nextTwoMonths",
]);
export type Preset = z.infer<typeof Preset>;
export const presetLabels: Record<Preset, string> = {
  thisWeekend: "This weekend",
  nextWeek: "Next week",
  nextTwoWeeks: "Next 2 weeks",
  nextMonth: "Next month",
  nextTwoMonths: "Next 2 months",
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

function wallClockAsUtc(date: Date, timezone: string): number {
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

type Ymd = { year: number; month: number; day: number };

export function ymd(date: string): Ymd {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return { year, month, day };
}

export const iso = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);

// How many days a month has; month is 1 to 12.
export const lastDayOf = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

export function addDays(date: string, days: number): string {
  const { year, month, day } = ymd(date);
  return iso(year, month, day + days);
}

// Days between two dates, positive when `to` is later.
export function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

export function datesIn(windowStart: string, windowEnd: string): string[] {
  const dates: string[] = [];
  for (let date = windowStart; date <= windowEnd; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

// 0 is Sunday.
export const weekdayOf = (date: string) =>
  new Date(`${date}T00:00:00Z`).getUTCDay();

// Whether the window's last day is over everywhere on Earth. Window days
// are the organizer's calendar days and no timezone is kept, so an event
// stays open while that day is still going on somewhere: it ends last at
// UTC-12, 36 hours after it began at UTC.
export function hasEnded(windowEnd: string, now = new Date()): boolean {
  return now.getTime() >= Date.parse(`${windowEnd}T00:00:00Z`) + 36 * 3_600_000;
}

// The first and last day an event could fall on.
export type DateWindow = { windowStart: string; windowEnd: string };

// The quick picks as whole calendar units: weeks run Monday to Sunday, and
// "next" starts at the next one, so in November "Next 2 months" is December
// and January.
export function presetWindow(preset: Preset, today: string): DateWindow {
  const span = (from: number, to: number) => ({
    windowStart: addDays(today, from),
    windowEnd: addDays(today, to),
  });
  const weekday = weekdayOf(today);
  const toMonday = (8 - weekday) % 7 || 7;
  const { year, month } = ymd(today);
  const months = (count: number) => ({
    windowStart: iso(year, month + 1, 1),
    windowEnd: iso(year, month + 1 + count, 0),
  });
  switch (preset) {
    case "thisWeekend":
      // The coming Saturday and Sunday, or what is left of this weekend.
      return weekday === 0 ? span(0, 0) : span(6 - weekday, 7 - weekday);
    case "nextWeek":
      return span(toMonday, toMonday + 6);
    case "nextTwoWeeks":
      return span(toMonday, toMonday + 13);
    case "nextMonth":
      return months(1);
    case "nextTwoMonths":
      return months(2);
  }
}

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const mon = (d: Ymd) => monthNames[d.month - 1];

// "Dec 11", "Dec 11 – 14", "Dec 27 – Jan 2".
export function dayRange(start: string, end: string): string {
  const a = ymd(start);
  const b = ymd(end);
  if (start === end) return `${mon(a)} ${a.day}`;
  if (a.year === b.year && a.month === b.month)
    return `${mon(a)} ${a.day} – ${b.day}`;
  return `${mon(a)} ${a.day} – ${mon(b)} ${b.day}`;
}

// The same with years: "Nov 14 – 15, 2026", "Dec 1, 2026 – Jan 31, 2027".
export function exactRange(start: string, end: string): string {
  const a = ymd(start);
  const b = ymd(end);
  if (a.year === b.year) return `${dayRange(start, end)}, ${a.year}`;
  return `${mon(a)} ${a.day}, ${a.year} – ${mon(b)} ${b.day}, ${b.year}`;
}

// What an invite says before anyone has picked days: the days when the
// window is two weeks or less, the months otherwise ("Dec – Jan", or
// "Dec 2026 – Jan 2027" with years).
export function approxRange(start: string, end: string, years = false): string {
  if (daysBetween(start, end) < 14)
    return years ? exactRange(start, end) : dayRange(start, end);
  const a = ymd(start);
  const b = ymd(end);
  const name = (d: Ymd) => (years ? `${mon(d)} ${d.year}` : mon(d));
  return a.year === b.year && a.month === b.month
    ? name(a)
    : `${name(a)} – ${name(b)}`;
}
