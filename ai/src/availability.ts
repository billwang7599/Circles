import {
  WEEK_MIN,
  mergeIntervals,
  parseInstant,
  weekMinutes,
  type AvailabilitySlot,
  type Candidate,
  type OpeningPeriod,
  type TimeWindow,
} from "@circles/shared";

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
export function toSlot(window: TimeWindow, timezone: string): AvailabilitySlot {
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
  freeWindows: TimeWindow[],
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
): TimeWindow[] {
  const hours = candidate.openingHours;
  if (!hours) return [];
  const open = slots.filter((s) => openCovers(hours, s));
  return mergeIntervals(
    open.map((s) => ({ start: s.start, end: s.end })),
  ).slice(0, maxRanges);
}
