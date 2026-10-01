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
  maxDistanceKm: number;
  /** Times within the range when no member is unavailable. */
  freeWindows: TimeWindow[];
  timezone: string;
}

/**
 * Hard constraints derived in plain code, never by the LLM. Either cap must hold for
 * everyone, so the group budget and distance are the minimum across members.
 */
export function deriveConstraints(
  group: GroupContext,
  range: TimeWindow,
): GroupConstraints {
  const { members } = group;
  return {
    partySize: members.length,
    maxPriceLevel: priceLevelForBudget(
      Math.min(...members.map((m) => m.budget)),
    ),
    maxDistanceKm: Math.min(...members.map((m) => m.maxDistanceKm)),
    freeWindows: subtractIntervals(
      range,
      members.flatMap((m) => m.unavailable),
    ),
    timezone: group.timezone,
  };
}
