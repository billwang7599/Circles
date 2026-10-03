import type { FilterName } from "./filters.ts";
import type { Candidate, LatLng } from "./place.ts";
import type { TimeWindow } from "./window.ts";

/**
 * A candidate meeting time, with its start and end also read on the local clock as
 * minutes from Sunday 00:00, to compare against a place's opening hours.
 */
export interface AvailabilitySlot {
  start: string; // UTC ISO 8601, ends in Z
  end: string;
  startMin: number;
  endMin: number; // greater than startMin, so it can pass 10080 across the week end
}

/** What the filters check. All derived in code from the group, never by the LLM. */
export interface SearchFields {
  /** What to search for, as the group typed it. Passed to the places search as is. */
  query?: string;
  /** The number of people in the group. */
  partySize: number;
  /** Times when every member is free. A place must be open for at least one. */
  slots?: AvailabilitySlot[];
  maxPriceLevel?: number; // 0-4, derived from the group budget
  /** Where the group wants to be, and how far out the search looks. */
  area?: { center: LatLng; radiusKm: number };
}

export interface PlanOption {
  candidateId: string;
  rationale: string;
  constraintChecks: string[];
  /** Upcoming times when the group is free and the place is open. Empty if hours are unknown. */
  availableTimes: TimeWindow[];
  /** How far the place is from the search location, in km. Closer places rank higher. */
  distanceKm: number;
  /** Filters set to "prefer" that this place does not meet. Empty means it meets them all. */
  unmet: FilterName[];
}

/** What the planner returns to clients. */
export type PlanResponse =
  | {
      status: "ok";
      options: PlanOption[];
      candidates: Candidate[];
      /** Set when fewer places than asked for met the must-haves, and why. */
      notice?: string;
    }
  | { status: "no_matches"; reason: string; message: string };

export type PlanStage = "searching" | "ranking";

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
