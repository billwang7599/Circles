import { expect, test } from "vitest";
import { nextMove, planActions } from "./actions.ts";
import type { OptionView, PlanPhase, PlanView } from "./plan.ts";

const open = (options: "none" | "fresh" | "stale"): PlanPhase => ({
  kind: "open",
  options,
});

const member = {
  phase: open("fresh"),
  registered: true,
  attending: true,
  voted: false,
};

test.each<[string, Partial<typeof member>, ReturnType<typeof nextMove>]>([
  ["in, fresh options, no vote yet", {}, "vote"],
  ["not answered", { registered: false }, "inputs"],
  ["already voted", { voted: true }, null],
  ["can't make it", { attending: false }, null],
  ["options stale", { phase: open("stale") }, null],
  [
    "not answered, locked",
    { phase: { kind: "locked" }, registered: false },
    null,
  ],
])("next move when %s", (_, changes, move) => {
  expect(nextMove({ ...member, ...changes })).toBe(move);
});

type Member = PlanView["members"][number];
const nicky: Member = {
  id: "n",
  name: "Nicky",
  color: "violet",
  registered: true,
  attending: true,
  voteOptionId: null,
};
const bill: Member = { ...nicky, id: "b", name: "Bill" };
const out: Member = { ...bill, registered: false, attending: false };
const declined = {
  registration: { attending: false, busy: [], preferences: [] },
};

// Nicky's plan with Bill, as `me` sees it; Nicky is in unless `me` says otherwise.
const view = (
  phase: PlanPhase,
  patch: {
    me?: Partial<PlanView["me"]>;
    members?: Member[];
    options?: [];
  } = {},
): PlanView => ({
  plan: {
    id: "p",
    title: "Ramen",
    circle: { id: "c", name: "Dinner club" },
    area: { id: "uw", name: "Waterloo" },
    windowStart: "2026-10-27",
    parts: ["morning", "afternoon", "evening"],
    windowEnd: "2026-10-27",
    phase,
    initiator: { id: "n", name: "Nicky" },
  },
  members: patch.members ?? [nicky, bill],
  me: {
    id: "n",
    registration: {
      attending: true,
      budgetCents: 3000,
      busy: [],
      preferences: [],
    },
    defaults: { preferences: [] },
    ...patch.me,
  },
  options: patch.options ?? [{ id: "o" } as OptionView],
});

// The actions on offer, naming which options run where one is.
const offered = (v: PlanView) =>
  Object.entries(planActions(v))
    .filter(([, on]) => on)
    .map(([name, on]) => (on === true ? name : `${name}:${on}`))
    .sort();

test.each<[string, PlanView, string[]]>([
  [
    "the initiator, fresh options",
    view(open("fresh")),
    ["decline", "edit", "getOptions:new", "initiator", "lock", "open", "vote"],
  ],
  [
    "a member, fresh options",
    view(open("fresh"), { me: { id: "b" } }),
    ["decline", "open", "vote"],
  ],
  [
    "a member who can't make it",
    view(open("fresh"), { me: { id: "b", ...declined } }),
    ["open"],
  ],
  [
    "a member who hasn't answered",
    view(open("fresh"), { me: { id: "b", registration: undefined } }),
    ["decline", "open"],
  ],
  [
    "the initiator, no options, two in",
    view(open("none"), { options: [] }),
    ["decline", "edit", "getOptions:first", "initiator", "open"],
  ],
  [
    "a member, no options, two in",
    view(open("none"), { options: [], me: { id: "b" } }),
    ["decline", "getOptions:first", "open"],
  ],
  [
    "the initiator, no options, one in",
    view(open("none"), { options: [], members: [nicky, out] }),
    ["decline", "edit", "initiator", "open"],
  ],
  [
    "the initiator, stale options",
    view(open("stale")),
    ["decline", "edit", "getOptions:new", "initiator", "lock", "open", "stale"],
  ],
  ["the initiator, locked", view({ kind: "locked" }), ["initiator", "unlock"]],
  ["the initiator, past", view({ kind: "past" }), ["initiator"]],
])("%s", (_, v, names) => {
  expect(offered(v)).toEqual(names);
});
