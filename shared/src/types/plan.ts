import type { Candidate, LatLng } from "./place.js";
import type { TimeWindow } from "./window.js";

/** Hard constraints the filters enforce. Built in code from the group and the parsed request. */
export interface SearchFields {
  cuisine?: string;
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

/** What the planner returns to clients. */
export type PlanResponse =
  | { status: "ok"; options: PlanOption[]; candidates: Candidate[] }
  | { status: "no_matches"; reason: string; message: string };
