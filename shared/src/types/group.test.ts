import { describe, expect, test } from "vitest";
import {
  DEFAULT_RADIUS_KM,
  GroupContextSchema,
  PlanRequestSchema,
} from "./group.ts";
import type { User } from "./user.ts";

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
