import { addDays, localDate, type Interval, type Part } from "@circles/shared";
import { WEEK_MIN, mergeIntervals, parseInstant, weekMinutes } from "./time.ts";
import {
  type AvailabilitySlot,
  type Candidate,
  type OpeningPeriod,
  type TimeFilter,
  WEEKDAYS,
} from "./types.ts";

export interface SlotOptions {
  /** How long the outing lasts. Default 2 hours. */
  durationMin?: number;
  /** Gap between candidate start times. Default 30 minutes. */
  stepMin?: number;
  /** Earliest local start hour, inclusive. Default 11 (11:00). */
  earliestHour?: number;
  /** Latest local start hour, inclusive. Default 21 (21:00). */
  latestStartHour?: number;
}

const MIN_MS = 60_000;

/** A time window with its local week-minutes filled in. */
export function toSlot(window: Interval, timezone: string): AvailabilitySlot {
  const startMin = weekMinutes(window.start, timezone);
  let endMin = weekMinutes(window.end, timezone);
  if (endMin <= startMin) endMin += WEEK_MIN;
  return { start: window.start, end: window.end, startMin, endMin };
}

/**
 * Meeting times inside the group's free windows: every `stepMin`, a slot of
 * `durationMin`, kept if it starts within the allowed local hours.
 */
export function generateSlots(
  freeWindows: Interval[],
  timezone: string,
  {
    durationMin = 120,
    stepMin = 30,
    earliestHour = 11,
    latestStartHour = 21,
  }: SlotOptions = {},
): AvailabilitySlot[] {
  const step = stepMin * MIN_MS;
  const duration = durationMin * MIN_MS;
  const slots: AvailabilitySlot[] = [];
  for (const free of freeWindows) {
    const freeEnd = parseInstant(free.end);
    // Start on the next step boundary at or after the window start.
    let t = Math.ceil(parseInstant(free.start) / step) * step;
    for (; t + duration <= freeEnd; t += step) {
      const slot = toSlot(
        {
          start: new Date(t).toISOString(),
          end: new Date(t + duration).toISOString(),
        },
        timezone,
      );
      const hour = (slot.startMin % 1440) / 60;
      if (hour >= earliestHour && hour <= latestStartHour) slots.push(slot);
    }
  }
  return slots;
}

/** Is the place open for the whole slot? */
export function openCovers(
  hours: OpeningPeriod[],
  slot: AvailabilitySlot,
): boolean {
  // Also check the period shifted a week back, so a period wrapping past Saturday
  // midnight covers an early-Sunday slot.
  return hours.some(
    ({ openMin, closeMin }) =>
      (slot.startMin >= openMin && slot.endMin <= closeMin) ||
      (slot.startMin + WEEK_MIN >= openMin &&
        slot.endMin + WEEK_MIN <= closeMin),
  );
}

/**
 * Upcoming stretches when the group is free and the place is open, earliest first.
 * Slots that overlap or touch are merged into one stretch. Empty if hours are unknown.
 */
export function availableTimes(
  candidate: Candidate,
  slots: AvailabilitySlot[],
  maxRanges = 3,
): Interval[] {
  const hours = candidate.openingHours;
  if (!hours) return [];
  const open = slots.filter((s) => openCovers(hours, s));
  return mergeIntervals(
    open.map((s) => ({ start: s.start, end: s.end })),
  ).slice(0, maxRanges);
}

/** Local start hours each part of the day covers, inclusive. */
export const PART_HOURS: Record<Part, [number, number]> = {
  morning: [8, 11],
  afternoon: [12, 16],
  evening: [17, 21],
};

/**
 * Slot hours to generate for a time filter. Asking for mornings needs slots before the
 * default 11:00 start, so the range widens to cover every part asked for.
 */
export function slotOptionsForTime(
  filter: TimeFilter | undefined,
): SlotOptions {
  const parts = filter?.partsOfDay ?? [];
  if (parts.length === 0) return {};
  const ranges = parts.map((p) => PART_HOURS[p]);
  return {
    earliestHour: Math.min(...ranges.map((r) => r[0])),
    latestStartHour: Math.max(...ranges.map((r) => r[1])),
  };
}

/**
 * Keep only slots on the days and in the parts of the day asked for. Days such as
 * "tomorrow" and "weekend" are resolved here, from the clock and the zone, so the
 * model never does date arithmetic.
 */
export function filterSlotsByTime(
  slots: AvailabilitySlot[],
  filter: TimeFilter | undefined,
  timezone: string,
  now: Date,
): AvailabilitySlot[] {
  const days = filter?.days ?? [];
  const parts = filter?.partsOfDay ?? [];
  if (days.length === 0 && parts.length === 0) return slots;

  const today = localDate(now, timezone);
  const tomorrow = addDays(today, 1);
  const weekdayOk = (weekday: number, date: string) =>
    days.length === 0 ||
    days.some((d) => {
      if (d === "today") return date === today;
      if (d === "tomorrow") return date === tomorrow;
      if (d === "weekend") return weekday === 0 || weekday === 6;
      if (d === "weekdays") return weekday >= 1 && weekday <= 5;
      return WEEKDAYS.indexOf(d) === weekday;
    });

  return slots.filter((slot) => {
    const weekday = Math.floor(slot.startMin / 1440) % 7;
    const hour = Math.floor((slot.startMin % 1440) / 60);
    const date = localDate(new Date(slot.start), timezone);
    return (
      weekdayOk(weekday, date) &&
      (parts.length === 0 ||
        parts.some((p) => hour >= PART_HOURS[p][0] && hour <= PART_HOURS[p][1]))
    );
  });
}
