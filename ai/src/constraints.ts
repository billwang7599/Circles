import {
  subtractIntervals,
  type GroupContext,
  type TimeWindow,
} from "@circles/shared";

/** Placeholder table: per-person budget to Google's 0-4 price level. Tune later. */
const PRICE_LEVEL_CEILINGS = [0, 15, 30, 60]; // up to each value maps to level 0..3, above is 4

export function priceLevelForBudget(budget: number): number {
  const level = PRICE_LEVEL_CEILINGS.findIndex((ceiling) => budget <= ceiling);
  return level === -1 ? 4 : level;
}

export interface GroupConstraints {
  partySize: number;
  maxPriceLevel: number;
  /** Times within the range when no member is unavailable. All UTC, whatever zone each member works in. */
  freeWindows: TimeWindow[];
}

/**
 * Hard constraints derived in plain code, never by the LLM. A cap must hold for
 * everyone, so the group budget is the lowest member budget. Free time is the part of
 * the range when no member is unavailable. Everyone is assumed able to reach the place;
 * where to look is the planner's choice, not a per-person limit.
 */
export function deriveConstraints(
  group: GroupContext,
  range: TimeWindow,
  /** Replaces the lowest member budget when the planner set one. */
  budgetPerPerson?: number,
): GroupConstraints {
  const { members } = group;
  return {
    partySize: members.length,
    maxPriceLevel: priceLevelForBudget(
      budgetPerPerson ?? Math.min(...members.map((m) => m.budget)),
    ),
    freeWindows: subtractIntervals(
      range,
      members.flatMap((m) => m.unavailable),
    ),
  };
}
