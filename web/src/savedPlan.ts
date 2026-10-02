import type { PlanJob, PlanResponse } from "@circles/shared";

export interface SavedOption {
  candidateId: string;
  name: string;
  rationale: string;
  constraintChecks: string[];
  rating?: number;
  priceLevel?: number;
}

export type SavedOutcome =
  | { status: "pending"; stage?: string }
  | { status: "ok"; options: SavedOption[] }
  | { status: "no_matches"; message: string }
  | { status: "error"; message: string };

/** A planning attempt, kept whether or not it found anything. */
export interface SavedPlan {
  id: string;
  createdAt: string;
  request: string;
  cityName: string;
  members: number;
  outcome: SavedOutcome;
}

/** Keep only what the list needs, so many plans fit in localStorage. */
export function toOutcome(res: PlanResponse): SavedOutcome {
  if (res.status === "no_matches")
    return { status: "no_matches", message: res.message };
  return {
    status: "ok",
    options: res.options.map((o) => {
      const place = res.candidates.find((c) => c.id === o.candidateId);
      return {
        candidateId: o.candidateId,
        name: place?.name ?? o.candidateId,
        rationale: o.rationale,
        constraintChecks: o.constraintChecks,
        ...(place?.rating !== undefined ? { rating: place.rating } : {}),
        ...(place?.priceLevel !== undefined
          ? { priceLevel: place.priceLevel }
          : {}),
      };
    }),
  };
}

/** The saved view of a background plan at its current state. */
export function jobToOutcome(job: PlanJob): SavedOutcome {
  if (job.status === "failed") {
    return { status: "error", message: job.error ?? "Planning failed." };
  }
  if (job.status === "done" && job.result) return toOutcome(job.result);
  return job.stage
    ? { status: "pending", stage: job.stage }
    : { status: "pending" };
}
