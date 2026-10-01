import { describe, expect, test } from "vitest";
import { UserSchema } from "./user.js";

const valid = {
  id: "u1",
  name: "Bill",
  unavailable: [{ start: "2026-10-03T18:00:00Z", end: "2026-10-03T20:00:00Z" }],
  budget: 25,
  maxDistanceKm: 5,
};

describe("UserSchema", () => {
  test("accepts a valid user", () => {
    expect(UserSchema.parse(valid)).toEqual(valid);
  });
  test("accepts no unavailable blocks", () => {
    expect(UserSchema.safeParse({ ...valid, unavailable: [] }).success).toBe(
      true,
    );
  });
  test("rejects non-UTC, inverted, or empty time blocks", () => {
    for (const block of [
      { start: "2026-10-03T18:00:00-04:00", end: "2026-10-03T20:00:00Z" },
      { start: "2026-10-03T20:00:00Z", end: "2026-10-03T18:00:00Z" },
      { start: "2026-10-03T18:00:00Z", end: "2026-10-03T18:00:00Z" },
    ]) {
      expect(
        UserSchema.safeParse({ ...valid, unavailable: [block] }).success,
      ).toBe(false);
    }
  });
  test("rejects a blank name", () => {
    expect(UserSchema.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });
  test("rejects negative budget and non-positive distance", () => {
    expect(UserSchema.safeParse({ ...valid, budget: -1 }).success).toBe(false);
    expect(UserSchema.safeParse({ ...valid, maxDistanceKm: 0 }).success).toBe(
      false,
    );
  });
});
