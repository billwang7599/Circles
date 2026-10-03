import type {
  Candidate,
  FilterModes,
  FilterName,
  LatLng,
  SearchFields,
} from "@circles/shared";
import { FILTER_NAMES } from "@circles/shared";
import { openCovers } from "./availability.ts";

export type Filter = (c: Candidate, f: SearchFields) => boolean;

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

/** Inside the radius the planner chose around the search location. */
export const withinArea: Filter = (c, f) => {
  if (!f.area) return true;
  return distanceKm(f.area.center, c.location) <= f.area.radiusKm;
};

/** Open for the whole of at least one of the group's free slots. */
export const openDuringSlots: Filter = (c, f) => {
  if (!f.slots) return true;
  if (!c.openingHours) return true;
  const hours = c.openingHours;
  return f.slots.some((slot) => openCovers(hours, slot));
};

export const fitsParty: Filter = (c, f) =>
  c.maxPartySize === undefined || c.maxPartySize >= f.partySize;

export const FILTERS: Record<FilterName, Filter> = {
  budget: withinBudget,
  openHours: openDuringSlots,
  area: withinArea,
  partySize: fitsParty,
};

export interface FilterResult {
  /** Candidates that meet every filter set to "hard". */
  passed: Candidate[];
  /** For each passed candidate, the "prefer" filters it does not meet. */
  unmet: Record<string, FilterName[]>;
  /** How many candidates each filter rejects when applied on its own. */
  rejectedBy: Record<FilterName, number>;
  /** The hard filter that rejects the most candidates alone. Undefined when nothing is rejected. */
  mostRestrictive?: FilterName;
}

/**
 * Hard filters drop candidates. Preferred filters never drop one; they only record which
 * preferences each remaining candidate misses, so the ranking can put those last.
 */
export function applyFilters(
  candidates: Candidate[],
  fields: SearchFields,
  modes: FilterModes,
): FilterResult {
  const hard = FILTER_NAMES.filter((n) => modes[n] === "hard");
  const prefer = FILTER_NAMES.filter((n) => modes[n] === "prefer");
  const rejectedBy = Object.fromEntries(
    FILTER_NAMES.map((n) => [
      n,
      candidates.filter((c) => !FILTERS[n](c, fields)).length,
    ]),
  ) as Record<FilterName, number>;
  const passed = candidates.filter((c) =>
    hard.every((n) => FILTERS[n](c, fields)),
  );
  const unmet = Object.fromEntries(
    passed.map((c) => [c.id, prefer.filter((n) => !FILTERS[n](c, fields))]),
  );
  const top = hard.reduce<FilterName | undefined>(
    (a, b) => (a === undefined || rejectedBy[b] > rejectedBy[a] ? b : a),
    undefined,
  );
  return {
    passed,
    unmet,
    rejectedBy,
    mostRestrictive: top && rejectedBy[top] > 0 ? top : undefined,
  };
}

/** Constraints that are set but could not be checked for this candidate because its data is missing. */
export function unverifiedFilters(c: Candidate, f: SearchFields): FilterName[] {
  const out: FilterName[] = [];
  if (f.maxPriceLevel !== undefined && c.priceLevel === undefined)
    out.push("budget");
  if (f.slots && !c.openingHours) out.push("openHours");
  if (c.maxPartySize === undefined) out.push("partySize");
  return out;
}
