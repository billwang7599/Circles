// Time conventions: every instant is an ISO 8601 UTC string ending in "Z".
// Intervals are half-open, [start, end). Local-clock concepts (opening hours,
// "Saturday evening") use an IANA timezone passed alongside, never a bare offset.
import type { TimeWindow } from "./types.js";

export const WEEK_MIN = 7 * 24 * 60;

const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;

/** Parse a UTC instant. Throws on anything not ending in "Z" or not a real date. */
export function parseInstant(iso: string): number {
  const ms = UTC_ISO.test(iso) ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) throw new Error(`Not a UTC ISO 8601 instant: ${iso}`);
  return ms;
}

/** Build a validated half-open interval. Throws if end is not after start. */
export function makeInterval(start: string, end: string): TimeWindow {
  if (!(parseInstant(end) > parseInstant(start))) {
    throw new Error(`Interval end must be after start: ${start} .. ${end}`);
  }
  return { start, end };
}

/** Half-open overlap: touching intervals do not overlap. */
export function overlaps(a: TimeWindow, b: TimeWindow): boolean {
  return (
    parseInstant(a.start) < parseInstant(b.end) &&
    parseInstant(b.start) < parseInstant(a.end)
  );
}

/** Overlap of two intervals, or undefined if they don't overlap. */
export function intersect(
  a: TimeWindow,
  b: TimeWindow,
): TimeWindow | undefined {
  if (!overlaps(a, b)) return undefined;
  const start = Math.max(parseInstant(a.start), parseInstant(b.start));
  const end = Math.min(parseInstant(a.end), parseInstant(b.end));
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}

/** Intersection of two sets of intervals (e.g. two members' free time). */
export function intersectAll(a: TimeWindow[], b: TimeWindow[]): TimeWindow[] {
  return a.flatMap((x) => b.flatMap((y) => intersect(x, y) ?? []));
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Minutes from Sunday 00:00 of the instant, as read in the given IANA zone. */
export function weekMinutes(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(parseInstant(iso)));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    get("weekday"),
  );
  return day * 1440 + Number(get("hour")) * 60 + Number(get("minute"));
}
