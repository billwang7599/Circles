import {
  WEEK_MIN,
  isValidTimeZone,
  parseInstant,
  weekMinutes,
} from "@circles/shared";
import type { Candidate, LatLng, SearchFields } from "@circles/shared";

export type FilterName = "budget" | "distance" | "openHours" | "partySize";

export interface FilterContext {
  /** IANA zone the window is read in, to compare against the place's local opening hours. */
  timezone: string;
}

export type Filter = (
  c: Candidate,
  f: SearchFields,
  ctx: FilterContext,
) => boolean;

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Unknown data fails open: a candidate is not rejected for missing data, and the final
// choice is the user's. Use unverifiedFilters to tell them what could not be checked.

export const withinBudget: Filter = (c, f) => {
  if (f.maxPriceLevel === undefined) return true;
  return c.priceLevel === undefined || c.priceLevel <= f.maxPriceLevel;
};

export const withinDistance: Filter = (c, f) => {
  if (!f.center || f.maxDistanceKm === undefined) return true;
  return distanceKm(f.center, c.location) <= f.maxDistanceKm;
};

export const openDuringWindow: Filter = (c, f, ctx) => {
  if (!f.window) return true;
  if (!c.openingHours) return true;
  if (!isValidTimeZone(ctx.timezone)) return false;
  const length = parseInstant(f.window.end) - parseInstant(f.window.start);
  if (!(length > 0) || length >= WEEK_MIN * 60000) return false;
  // Read both ends on the local clock, so a daylight saving jump inside the window is handled.
  const start = weekMinutes(f.window.start, ctx.timezone);
  let end = weekMinutes(f.window.end, ctx.timezone);
  if (end <= start) end += WEEK_MIN;
  // Also check the period shifted a week back, so a period wrapping past Saturday
  // midnight covers an early-Sunday window.
  return c.openingHours.some(
    ({ openMin, closeMin }) =>
      (start >= openMin && end <= closeMin) ||
      (start + WEEK_MIN >= openMin && end + WEEK_MIN <= closeMin),
  );
};

export const fitsParty: Filter = (c, f) =>
  c.maxPartySize === undefined || c.maxPartySize >= f.partySize;

export const FILTERS: Record<FilterName, Filter> = {
  budget: withinBudget,
  distance: withinDistance,
  openHours: openDuringWindow,
  partySize: fitsParty,
};

export interface FilterResult {
  passed: Candidate[];
  /** How many candidates each filter rejects when applied on its own. */
  rejectedBy: Record<FilterName, number>;
  /** Filter that rejects the most candidates alone. Undefined when nothing is rejected. */
  mostRestrictive?: FilterName;
}

export function applyFilters(
  candidates: Candidate[],
  fields: SearchFields,
  ctx: FilterContext,
): FilterResult {
  const names = Object.keys(FILTERS) as FilterName[];
  const rejectedBy = Object.fromEntries(
    names.map((n) => [
      n,
      candidates.filter((c) => !FILTERS[n](c, fields, ctx)).length,
    ]),
  ) as Record<FilterName, number>;
  const passed = candidates.filter((c) =>
    names.every((n) => FILTERS[n](c, fields, ctx)),
  );
  const top = names.reduce((a, b) => (rejectedBy[b] > rejectedBy[a] ? b : a));
  return {
    passed,
    rejectedBy,
    mostRestrictive: rejectedBy[top] > 0 ? top : undefined,
  };
}

/** Constraints that are set but could not be checked for this candidate because its data is missing. */
export function unverifiedFilters(c: Candidate, f: SearchFields): FilterName[] {
  const out: FilterName[] = [];
  if (f.maxPriceLevel !== undefined && c.priceLevel === undefined)
    out.push("budget");
  if (f.window && !c.openingHours) out.push("openHours");
  if (c.maxPartySize === undefined) out.push("partySize");
  return out;
}
