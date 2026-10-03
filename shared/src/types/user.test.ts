import { describe, expect, test } from "vitest";
import { UserSchema } from "./user.ts";

const valid = {
  id: "u1",
  name: "Bill",
  location: {
    name: "Toronto",
    lat: 43.65,
    lng: -79.38,
    timezone: "America/Toronto",
  },
  unavailable: [{ start: "2026-10-03T18:00:00Z", end: "2026-10-03T20:00:00Z" }],
  budget: 25,
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
  test("rejects a negative budget", () => {
    expect(UserSchema.safeParse({ ...valid, budget: -1 }).success).toBe(false);
  });

  test("rejects a missing or invalid location", () => {
    const noLocation: Partial<typeof valid> = { ...valid };
    delete noLocation.location;
    expect(UserSchema.safeParse(noLocation).success).toBe(false);
    for (const bad of [
      { ...valid.location, lat: 91 },
      { ...valid.location, lng: -181 },
      { ...valid.location, timezone: "Nowhere/Land" },
      { ...valid.location, name: "" },
    ]) {
      expect(UserSchema.safeParse({ ...valid, location: bad }).success).toBe(
        false,
      );
    }
  });
});
