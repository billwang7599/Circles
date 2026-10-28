import {
  Part,
  areaById,
  datesIn,
  partInterval,
  subtractIntervals,
  type Interval,
} from "@circles/shared";
import { mergeIntervals } from "./time.ts";
import type { PlanRequest } from "./types.ts";

/** Placeholder table: per-person budget to Google's 0-4 price level. Tune later. */
const PRICE_LEVEL_CEILINGS_CENTS = [0, 1500, 3000, 6000]; // up to each value maps to level 0..3, above is 4

export function priceLevelForBudget(budgetCents: number): number {
  const level = PRICE_LEVEL_CEILINGS_CENTS.findIndex(
    (ceiling) => budgetCents <= ceiling,
  );
  return level === -1 ? 4 : level;
}

// Without an override, the lowest budget: the cap must hold for everyone.
export const effectiveBudgetCents = (request: PlanRequest): number =>
  request.budgetCents ??
  Math.min(...request.group.members.map((m) => m.budgetCents));

export interface GroupConstraints {
  partySize: number;
  maxPriceLevel: number;
  freeWindows: Interval[];
}

export function deriveConstraints(
  request: PlanRequest,
  now: Date,
): GroupConstraints {
  const { members } = request.group;
  const { timezone } = areaById(request.areaId);
  const parts = datesIn(request.windowStart, request.windowEnd).flatMap(
    (date) => Part.options.map((part) => partInterval(date, part, timezone)),
  );
  const busy = members.flatMap((m) =>
    m.busy.map((b) => partInterval(b.date, b.part, timezone)),
  );
  const past = { start: new Date(0).toISOString(), end: now.toISOString() };
  return {
    partySize: members.length,
    maxPriceLevel: priceLevelForBudget(effectiveBudgetCents(request)),
    // Merged so a meal can run across two free parts, such as late morning into lunch.
    freeWindows: mergeIntervals(subtractIntervals(parts, [past, ...busy])),
  };
}
