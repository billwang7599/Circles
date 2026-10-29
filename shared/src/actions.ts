import type { PlanSummary, PlanView } from "./plan.ts";

// What an open plan still needs from a member: their answers, or a vote on
// fresh options. The circle list and the next plan on /me both read it.
export function nextMove(
  plan: Pick<PlanSummary, "phase" | "registered" | "attending" | "voted">,
): "inputs" | "vote" | null {
  const { phase } = plan;
  if (phase.kind !== "open") return null;
  if (!plan.registered) return "inputs";
  return plan.attending && phase.options === "fresh" && !plan.voted
    ? "vote"
    : null;
}

// What the plan screen may offer a member right now. A vote can change, so
// `vote` does not care whether they voted already; anyone can get the first
// options once two people are in, only the initiator can get new ones.
export function planActions({ plan, members, me, options }: PlanView) {
  const { phase } = plan;
  const open = phase.kind === "open";
  const initiator = plan.initiator.id === me.id;
  const mine = me.registration?.attending;
  const attending = members.filter((m) => m.registered && m.attending).length;
  return {
    open,
    initiator,
    stale: phase.kind === "open" && phase.options === "stale",
    vote: phase.kind === "open" && phase.options === "fresh" && mine === true,
    decline: open && mine !== false,
    edit: initiator && open,
    lock: initiator && open && options.length > 0,
    unlock: initiator && phase.kind === "locked",
    getOptions: !open
      ? false
      : options.length === 0
        ? attending >= 2 && "first"
        : initiator && "new",
  };
}
