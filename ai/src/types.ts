import { z } from "zod";
import { parseInstant } from "./time.js";

// Draft types. The Circles data model is not final, so these are owned by the
// planner and expected to change. city, budget and availability are inputs.

const isInstant = (iso: string) => {
  try {
    parseInstant(iso);
    return true;
  } catch {
    return false;
  }
};

const instant = z
  .string()
  .refine(isInstant, "must be a UTC ISO 8601 instant ending in Z");

/** Half-open interval [start, end). Both are UTC ISO 8601 instants ending in "Z". See time.ts. */
export const TimeWindowSchema = z
  .object({ start: instant, end: instant })
  .refine(
    // Field checks may have failed already but this still runs, so guard it.
    (w) =>
      !isInstant(w.start) ||
      !isInstant(w.end) ||
      parseInstant(w.end) > parseInstant(w.start),
    "end must be after start",
  );

export type TimeWindow = z.infer<typeof TimeWindowSchema>;

export interface GroupContext {
  city: string;
  timezone: string; // IANA zone, e.g. "America/Toronto"
  budget: unknown; // TODO: shape undecided (per person, per group, ranges)
  availability: unknown; // TODO: shape undecided
  preferences?: string[];
  history?: unknown;
}

export interface PlanRequest {
  text: string;
  group: GroupContext;
}

export interface Candidate {
  id: string;
  name: string;
  priceLevel?: number;
  rating?: number;
  location: { lat: number; lng: number };
  /** Open periods in the place's local time. Missing means unknown. */
  openingHours?: OpeningPeriod[];
  /** Largest party the place can seat. Missing means unknown (Places has no capacity field). */
  maxPartySize?: number;
  source: string;
}

/** Minutes from Sunday 00:00 local time. A period crossing the week end has close > 10080. */
export interface OpeningPeriod {
  openMin: number;
  closeMin: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Output of the Parse step. These are the hard constraints the filters enforce. */
export interface SearchFields {
  cuisine?: string;
  tags?: string[];
  partySize: number;
  window?: TimeWindow;
  maxPriceLevel?: number; // 0-4, derived from the group budget
  center?: LatLng;
  maxDistanceKm?: number;
}

export interface PlanOption {
  candidateId: string;
  rationale: string;
  constraintChecks: string[];
}
