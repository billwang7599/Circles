// Time conventions: every instant is an ISO 8601 UTC string ending in "Z".
// Intervals are half-open, [start, end). Local-clock concepts (opening hours,
// "Saturday evening") use an IANA timezone passed alongside, never a bare offset.
import type { Interval } from "@circles/shared";

export const WEEK_MIN = 7 * 24 * 60;

const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;

/** Parse a UTC instant. Throws on anything not ending in "Z" or not a real date. */
export function parseInstant(iso: string): number {
  const ms = UTC_ISO.test(iso) ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) throw new Error(`Not a UTC ISO 8601 instant: ${iso}`);
  return ms;
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

const iso = (ms: number) => new Date(ms).toISOString();

/** Sort and merge overlapping or touching intervals. */
export function mergeIntervals(windows: Interval[]): Interval[] {
  const sorted = windows
    .map((w) => ({ s: parseInstant(w.start), e: parseInstant(w.end) }))
    .sort((a, b) => a.s - b.s);
  const out: { s: number; e: number }[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w.s <= last.e) last.e = Math.max(last.e, w.e);
    else out.push({ ...w });
  }
  return out.map((w) => ({ start: iso(w.s), end: iso(w.e) }));
}
