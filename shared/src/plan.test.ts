import { expect, test } from "vitest";
import { CreatePlan } from "./plan.ts";
import { presetWindow, type Preset } from "./time.ts";

const timezone = "America/Toronto";

// Noon in Toronto on a Thursday, a Saturday and a Sunday.
test.each<[string, Preset, string, string]>([
  ["2026-10-29T16:00:00Z", "today", "2026-10-29", "2026-10-29"],
  ["2026-10-29T16:00:00Z", "tomorrow", "2026-10-30", "2026-10-30"],
  ["2026-10-29T16:00:00Z", "weekend", "2026-10-31", "2026-11-01"],
  ["2026-10-31T16:00:00Z", "weekend", "2026-10-31", "2026-11-01"],
  ["2026-11-01T17:00:00Z", "weekend", "2026-11-01", "2026-11-01"],
  ["2026-10-29T16:00:00Z", "week", "2026-10-29", "2026-11-04"],
  ["2026-10-29T16:00:00Z", "twoWeeks", "2026-10-29", "2026-11-11"],
])("from %s, %s runs %s to %s", (now, preset, windowStart, windowEnd) => {
  expect(presetWindow(preset, timezone, new Date(now))).toEqual({
    windowStart,
    windowEnd,
  });
});

const plan = {
  title: "Ramen",
  areaId: "uw",
  windowStart: "2026-11-01",
  windowEnd: "2026-11-15",
  parts: ["evening", "morning", "evening"],
};

test("a plan's parts are kept in the day's order, once each", () => {
  expect(CreatePlan.parse(plan).parts).toEqual(["morning", "evening"]);
});

test.each([
  [{ windowEnd: "2026-10-31" }, "windowEnd"],
  [{ windowEnd: "2026-11-16" }, "windowEnd"],
  [{ parts: [] }, "parts"],
])("%o is refused on %s", (change, field) => {
  const parsed = CreatePlan.safeParse({ ...plan, ...change });
  expect(parsed.success).toBe(false);
  expect(parsed.error?.issues.map((i) => i.path[0])).toContain(field);
});
