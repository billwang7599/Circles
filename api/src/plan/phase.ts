import {
  areaById,
  windowFor,
  type AreaId,
  type PlanPhase,
  type PlanStatus,
} from "@circles/shared";

// The facts a plan's phase is decided from, as the plan queries return them.
export type PhaseRow = {
  status: PlanStatus;
  areaId: AreaId;
  windowEnd: string;
  lockedEnd: Date | null;
  version: number;
  optionsVersion: number | null;
  optionCount: number;
  lastStart: Date | null;
};

// An open plan ends with its last window day in the area's timezone, a locked
// one once its slot is over. Every write that invalidates options bumps the
// plan version and options record the version they were made for; they also
// expire once every time has started.
export function planPhase(plan: PhaseRow, now: Date): PlanPhase {
  if (plan.status === "locked")
    return plan.lockedEnd !== null && plan.lockedEnd.getTime() < now.getTime()
      ? { kind: "past" }
      : { kind: "locked" };
  const timezone = areaById(plan.areaId).timezone;
  if (windowFor("today", timezone, now).windowStart > plan.windowEnd)
    return { kind: "ended" };
  if (plan.optionCount === 0) return { kind: "open", options: "none" };
  const fresh =
    plan.optionsVersion === plan.version &&
    plan.lastStart !== null &&
    plan.lastStart.getTime() >= now.getTime();
  return { kind: "open", options: fresh ? "fresh" : "stale" };
}
