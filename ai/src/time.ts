// Time conventions: every instant is an ISO 8601 UTC string ending in "Z".
// Intervals are half-open, [start, end). Local-clock concepts (opening hours,
// "Saturday evening") use an IANA timezone passed alongside, never a bare offset.
import type { TimeWindow } from "./types.ts";

export const WEEK_MIN = 7 * 24 * 60;

const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;

/** Parse a UTC instant. Throws on anything not ending in "Z" or not a real date. */
export function parseInstant(iso: string): number {
  const ms = UTC_ISO.test(iso) ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) throw new Error(`Not a UTC ISO 8601 instant: ${iso}`);
  return ms;
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

function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// A wall-clock time that DST skips or repeats resolves to one of its two readings.
export function zonedToUtc(local: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    local,
  );
  if (!m) throw new Error(`Not a local date-time: ${local}`);
  const naive = Date.UTC(
    +m[1]!,
    +m[2]! - 1,
    +m[3]!,
    +m[4]!,
    +m[5]!,
    +(m[6] ?? 0),
  );
  // Guess with the offset at the naive time, then correct it with the offset at the guess.
  const guess = naive - zoneOffsetMs(naive, timeZone);
  return new Date(naive - zoneOffsetMs(guess, timeZone)).toISOString();
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Sort and merge overlapping or touching intervals. */
export function mergeIntervals(windows: TimeWindow[]): TimeWindow[] {
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

/** The parts of `range` not covered by any of `blocks`. */
export function subtractIntervals(
  range: TimeWindow,
  blocks: TimeWindow[],
): TimeWindow[] {
  const end = parseInstant(range.end);
  let cursor = parseInstant(range.start);
  const free: TimeWindow[] = [];
  for (const b of mergeIntervals(blocks)) {
    const bs = parseInstant(b.start);
    const be = parseInstant(b.end);
    if (be <= cursor) continue;
    if (bs >= end) break;
    if (bs > cursor) free.push({ start: iso(cursor), end: iso(bs) });
    cursor = Math.max(cursor, be);
  }
  if (cursor < end) free.push({ start: iso(cursor), end: iso(end) });
  return free;
}
