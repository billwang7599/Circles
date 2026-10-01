import { describe, expect, test } from "vitest";
import { GroupContextSchema, type User } from "@circles/shared";
import { deriveConstraints, priceLevelForBudget } from "./constraints.js";

const user = (over: Partial<User> = {}): User => ({
  id: "u",
  name: "U",
  budget: 25,
  maxDistanceKm: 5,
  unavailable: [],
  ...over,
});
const range = {
  start: "2026-10-03T09:00:00.000Z",
  end: "2026-10-03T18:00:00.000Z",
};
const group = (members: User[]) => ({
  city: "toronto",
  timezone: "America/Toronto",
  members,
});

describe("priceLevelForBudget", () => {
  test("maps edges of each band", () => {
    expect(priceLevelForBudget(0)).toBe(0);
    expect(priceLevelForBudget(15)).toBe(1);
    expect(priceLevelForBudget(15.01)).toBe(2);
    expect(priceLevelForBudget(30)).toBe(2);
    expect(priceLevelForBudget(60)).toBe(3);
    expect(priceLevelForBudget(61)).toBe(4);
  });
});

describe("deriveConstraints", () => {
  const members = [
    user({
      id: "a",
      budget: 40,
      maxDistanceKm: 10,
      unavailable: [
        { start: "2026-10-03T10:00:00.000Z", end: "2026-10-03T12:00:00.000Z" },
      ],
    }),
    user({
      id: "b",
      budget: 12,
      maxDistanceKm: 3,
      unavailable: [
        { start: "2026-10-03T11:00:00.000Z", end: "2026-10-03T13:00:00.000Z" },
      ],
    }),
  ];
  const c = deriveConstraints(GroupContextSchema.parse(group(members)), range);

  test("takes the strictest budget and distance across members", () => {
    expect(c.maxPriceLevel).toBe(1);
    expect(c.maxDistanceKm).toBe(3);
    expect(c.partySize).toBe(2);
    expect(c.timezone).toBe("America/Toronto");
  });
  test("free time excludes every member's unavailable blocks", () => {
    expect(c.freeWindows).toEqual([
      { start: "2026-10-03T09:00:00.000Z", end: "2026-10-03T10:00:00.000Z" },
      { start: "2026-10-03T13:00:00.000Z", end: "2026-10-03T18:00:00.000Z" },
    ]);
  });
});
