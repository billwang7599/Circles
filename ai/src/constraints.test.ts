import { areaById, partInterval, type Part } from "@circles/shared";
import { describe, expect, test } from "vitest";
import { PlanRequestSchema, type Member } from "./types.ts";
import { deriveConstraints, priceLevelForBudget } from "./constraints.ts";

const { timezone } = areaById("uptown");
const part = (date: string, p: Part) => partInterval(date, p, timezone);
const member = (over: Partial<Member> = {}): Member => ({
  id: "u",
  name: "U",
  budgetCents: 2500,
  busy: [],
  preferences: [],
  ...over,
});
const request = (members: Member[], windowEnd = "2026-10-03") =>
  PlanRequestSchema.parse({
    text: "dinner",
    group: { members },
    areaId: "uptown",
    windowStart: "2026-10-03",
    windowEnd,
  });
const BEFORE_WINDOW = new Date("2026-10-03T04:00:00Z"); // midnight local

describe("priceLevelForBudget", () => {
  test("maps edges of each band", () => {
    expect(priceLevelForBudget(0)).toBe(0);
    expect(priceLevelForBudget(1500)).toBe(1);
    expect(priceLevelForBudget(1501)).toBe(2);
    expect(priceLevelForBudget(3000)).toBe(2);
    expect(priceLevelForBudget(6000)).toBe(3);
    expect(priceLevelForBudget(6001)).toBe(4);
  });
});

describe("deriveConstraints", () => {
  test("takes the strictest budget across members, unless overridden", () => {
    const members = [
      member({ id: "a", budgetCents: 4000 }),
      member({ id: "b", budgetCents: 1200 }),
    ];
    const c = deriveConstraints(request(members), BEFORE_WINDOW);
    expect(c.maxPriceLevel).toBe(1);
    expect(c.partySize).toBe(2);
    const raised = { ...request(members), budgetCents: 10_000 };
    expect(deriveConstraints(raised, BEFORE_WINDOW).maxPriceLevel).toBe(4);
  });

  test("free time is every part of the window minus each member's busy parts", () => {
    const members = [
      member({ id: "a", busy: [{ date: "2026-10-03", part: "afternoon" }] }),
      member({ id: "b", busy: [{ date: "2026-10-03", part: "evening" }] }),
    ];
    const c = deriveConstraints(request(members, "2026-10-04"), BEFORE_WINDOW);
    expect(c.freeWindows).toEqual([
      part("2026-10-03", "morning"),
      {
        start: part("2026-10-04", "morning").start,
        end: part("2026-10-04", "evening").end,
      },
    ]);
  });

  test("free parts that touch are one stretch, so a meal can span them", () => {
    const c = deriveConstraints(request([member()]), BEFORE_WINDOW);
    expect(c.freeWindows).toEqual([
      {
        start: part("2026-10-03", "morning").start,
        end: part("2026-10-03", "evening").end,
      },
    ]);
  });

  test("time already past is not free", () => {
    const now = new Date("2026-10-03T15:00:00Z");
    const c = deriveConstraints(request([member()]), now);
    expect(c.freeWindows).toEqual([
      { start: now.toISOString(), end: part("2026-10-03", "evening").end },
    ]);
  });
});
