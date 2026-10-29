import type { PlanPhase } from "@circles/shared";
import { expect, test } from "vitest";
import { planPhase, type PhaseRow } from "./phase.ts";

// 23:30 on Oct 27 in Toronto: the window's last day has half an hour left.
const now = new Date("2026-10-28T03:30:00Z");
const hour = 3_600_000;
const at = (ms: number) => new Date(now.getTime() + ms);

const plan: PhaseRow = {
  status: "open",
  areaId: "uw",
  windowEnd: "2026-10-27",
  lockedEnd: null,
  version: 3,
  optionsVersion: 3,
  optionCount: 3,
  lastStart: at(hour),
};

test.each<[string, Partial<PhaseRow>, PlanPhase]>([
  ["fresh options", {}, { kind: "open", options: "fresh" }],
  [
    "no options",
    { optionCount: 0, lastStart: null },
    { kind: "open", options: "none" },
  ],
  [
    "inputs changed since the options",
    { version: 4 },
    { kind: "open", options: "stale" },
  ],
  [
    "every time has started",
    { lastStart: at(-hour) },
    { kind: "open", options: "stale" },
  ],
  ["window over", { windowEnd: "2026-10-26" }, { kind: "ended" }],
  [
    "locked with the slot ahead, whatever the version",
    { status: "locked", lockedEnd: at(hour), version: 4 },
    { kind: "locked" },
  ],
  [
    "locked with the slot over",
    { status: "locked", lockedEnd: at(-hour) },
    { kind: "past" },
  ],
])("%s", (_, changes, phase) => {
  expect(planPhase({ ...plan, ...changes }, now)).toEqual(phase);
});

test("an open plan ends with its last day in the area's timezone", () => {
  expect(planPhase(plan, now).kind).toBe("open");
  expect(planPhase(plan, at(hour)).kind).toBe("ended");
});
