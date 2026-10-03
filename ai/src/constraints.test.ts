import { describe, expect, test } from "vitest";
import { GroupContextSchema, type User } from "@circles/shared";
import { deriveConstraints, priceLevelForBudget } from "./constraints.ts";

const here = {
  name: "Toronto",
  lat: 43.65,
  lng: -79.38,
  timezone: "America/Toronto",
};
const user = (over: Partial<User> = {}): User => ({
  id: "u",
  name: "U",
  location: here,
  budget: 25,
  unavailable: [],
  ...over,
});
const range = {
  start: "2026-10-03T09:00:00.000Z",
  end: "2026-10-03T18:00:00.000Z",
};
const group = (members: User[]) => ({ members });

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
      unavailable: [
        { start: "2026-10-03T10:00:00.000Z", end: "2026-10-03T12:00:00.000Z" },
      ],
    }),
    user({
      id: "b",
      budget: 12,
      unavailable: [
        { start: "2026-10-03T11:00:00.000Z", end: "2026-10-03T13:00:00.000Z" },
      ],
    }),
  ];
  const c = deriveConstraints(GroupContextSchema.parse(group(members)), range);

  test("takes the strictest budget across members", () => {
    expect(c.maxPriceLevel).toBe(1);
    expect(c.partySize).toBe(2);
  });
  test("free time excludes every member's unavailable blocks", () => {
    expect(c.freeWindows).toEqual([
      { start: "2026-10-03T09:00:00.000Z", end: "2026-10-03T10:00:00.000Z" },
      { start: "2026-10-03T13:00:00.000Z", end: "2026-10-03T18:00:00.000Z" },
    ]);
  });
});

describe("deriveConstraints: members in different time zones", () => {
  test("free time is computed in UTC, whatever zone each member works in", () => {
    const vancouver = { ...here, timezone: "America/Vancouver" };
    const c = deriveConstraints(
      GroupContextSchema.parse(
        group([
          user({
            id: "a",
            unavailable: [
              {
                start: "2026-10-03T10:00:00.000Z",
                end: "2026-10-03T12:00:00.000Z",
              },
            ],
          }),
          user({
            id: "b",
            location: vancouver,
            unavailable: [
              {
                start: "2026-10-03T11:00:00.000Z",
                end: "2026-10-03T14:00:00.000Z",
              },
            ],
          }),
        ]),
      ),
      range,
    );
    expect(c.freeWindows).toEqual([
      { start: "2026-10-03T09:00:00.000Z", end: "2026-10-03T10:00:00.000Z" },
      { start: "2026-10-03T14:00:00.000Z", end: "2026-10-03T18:00:00.000Z" },
    ]);
  });
});
