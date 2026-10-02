import type { Candidate, LatLng } from "./place.ts";
import type { TimeWindow } from "./window.ts";

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

export type PlanStage = "parsing" | "searching" | "ranking";

export type PlanJobStatus = "pending" | "running" | "done" | "failed";

/** A planning run that works in the background. Clients watch it by id. */
export interface PlanJob {
  id: string;
  status: PlanJobStatus;
  /** Where a running job is up to. */
  stage?: PlanStage;
  /** Set when status is "done". */
  result?: PlanResponse;
  /** Set when status is "failed". */
  error?: string;
  createdAt: string;
  updatedAt: string;
}
