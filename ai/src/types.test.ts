import { describe, expect, test } from "vitest";
import {
  DEFAULT_RADIUS_KM,
  GroupContextSchema,
  PlanRequestSchema,
  UserSchema,
  type User,
} from "./types.ts";

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

const toronto = {
  name: "Toronto",
  lat: 43.65,
  lng: -79.38,
  timezone: "America/Toronto",
};
const user = (over: Partial<User> = {}): User => ({
  id: "u",
  name: "U",
  location: toronto,
  budget: 25,
  unavailable: [],
  ...over,
});
const group = (members: User[]) => ({ members });

describe("GroupContextSchema", () => {
  test("requires at least one member", () => {
    expect(GroupContextSchema.safeParse(group([user()])).success).toBe(true);
    expect(GroupContextSchema.safeParse(group([])).success).toBe(false);
  });
  test("members in the same time zone are fine, even at different places", () => {
    const other = { ...toronto, name: "Oshawa", lat: 43.9, lng: -78.86 };
    expect(
      GroupContextSchema.safeParse(
        group([user(), user({ id: "v", location: other })]),
      ).success,
    ).toBe(true);
  });
  test("members may be in different time zones", () => {
    const vancouver = {
      name: "Vancouver",
      lat: 49.28,
      lng: -123.12,
      timezone: "America/Vancouver",
    };
    expect(
      GroupContextSchema.safeParse(
        group([user(), user({ id: "v", location: vancouver })]),
      ).success,
    ).toBe(true);
  });
});

describe("PlanRequestSchema", () => {
  const base = { text: "ramen", group: group([user()]), location: toronto };

  test("the radius defaults to 15 km", () => {
    const parsed = PlanRequestSchema.parse(base);
    expect(parsed.radiusKm).toBe(DEFAULT_RADIUS_KM);
    expect(DEFAULT_RADIUS_KM).toBe(15);
  });
  test("accepts a chosen radius up to 50 km", () => {
    expect(PlanRequestSchema.parse({ ...base, radiusKm: 50 }).radiusKm).toBe(
      50,
    );
    expect(PlanRequestSchema.safeParse({ ...base, radiusKm: 51 }).success).toBe(
      false,
    );
    expect(PlanRequestSchema.safeParse({ ...base, radiusKm: 0 }).success).toBe(
      false,
    );
  });
  test("needs a search location and some text", () => {
    const noLocation: Partial<typeof base> = { ...base };
    delete noLocation.location;
    expect(PlanRequestSchema.safeParse(noLocation).success).toBe(false);
    expect(PlanRequestSchema.safeParse({ ...base, text: "" }).success).toBe(
      false,
    );
  });
});
