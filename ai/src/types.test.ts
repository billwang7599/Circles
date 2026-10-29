import { RegistrationInput, areaById } from "@circles/shared";
import { describe, expect, test } from "vitest";
import {
  GroupContextSchema,
  MAX_RADIUS_KM,
  MemberSchema,
  PlanRequestSchema,
  type Member,
} from "./types.ts";

const valid: Member = {
  id: "u1",
  name: "Bill",
  budgetCents: 2500,
  busy: [{ date: "2026-10-03", part: "evening" }],
  preferences: ["ramen"],
};

describe("MemberSchema", () => {
  test("accepts a valid member", () => {
    expect(MemberSchema.parse(valid)).toEqual(valid);
  });
  test("accepts no busy parts and no preferences", () => {
    expect(
      MemberSchema.safeParse({ ...valid, busy: [], preferences: [] }).success,
    ).toBe(true);
  });
  test("rejects a busy part with a bad date or an unknown part", () => {
    for (const part of [
      { date: "2026-10-03T18:00:00Z", part: "evening" },
      { date: "2026-13-40", part: "evening" },
      { date: "2026-10-03", part: "night" },
    ]) {
      expect(MemberSchema.safeParse({ ...valid, busy: [part] }).success).toBe(
        false,
      );
    }
  });
  test("rejects a blank name", () => {
    expect(MemberSchema.safeParse({ ...valid, name: "  " }).success).toBe(
      false,
    );
  });
  test("needs a budget in whole cents, within the app's limits", () => {
    const { minValue, maxValue } = RegistrationInput.shape.budgetCents.unwrap();
    for (const budgetCents of [undefined, 25.5, minValue! - 1, maxValue! + 1]) {
      expect(MemberSchema.safeParse({ ...valid, budgetCents }).success).toBe(
        false,
      );
    }
  });
  test("rejects an unknown preference", () => {
    expect(
      MemberSchema.safeParse({ ...valid, preferences: ["hotpot"] }).success,
    ).toBe(false);
  });
});

describe("GroupContextSchema", () => {
  test("requires at least one member", () => {
    expect(GroupContextSchema.safeParse({ members: [valid] }).success).toBe(
      true,
    );
    expect(GroupContextSchema.safeParse({ members: [] }).success).toBe(false);
  });
});

describe("PlanRequestSchema", () => {
  const base = {
    text: "ramen",
    group: { members: [valid] },
    areaId: "uptown",
    windowStart: "2026-10-03",
    windowEnd: "2026-10-09",
  };

  test("the radius defaults to the area's own", () => {
    expect(PlanRequestSchema.parse(base).radiusKm).toBe(
      areaById("uptown").radiusKm,
    );
    expect(
      PlanRequestSchema.parse({ ...base, areaId: "kitchener" }).radiusKm,
    ).toBe(areaById("kitchener").radiusKm);
  });
  test("accepts a chosen radius up to the maximum", () => {
    expect(
      PlanRequestSchema.parse({ ...base, radiusKm: MAX_RADIUS_KM }).radiusKm,
    ).toBe(MAX_RADIUS_KM);
    expect(
      PlanRequestSchema.safeParse({ ...base, radiusKm: MAX_RADIUS_KM + 1 })
        .success,
    ).toBe(false);
    expect(PlanRequestSchema.safeParse({ ...base, radiusKm: 0 }).success).toBe(
      false,
    );
  });
  test("needs a known area and some text", () => {
    for (const areaId of [undefined, "toronto"]) {
      expect(PlanRequestSchema.safeParse({ ...base, areaId }).success).toBe(
        false,
      );
    }
    expect(PlanRequestSchema.safeParse({ ...base, text: "" }).success).toBe(
      false,
    );
  });
  test("needs a window of dates that does not end before it starts", () => {
    expect(
      PlanRequestSchema.safeParse({ ...base, windowEnd: "2026-10-03" }).success,
    ).toBe(true);
    for (const over of [
      { windowEnd: "2026-10-02" },
      { windowStart: "2026-10-03T00:00:00Z" },
      { windowEnd: undefined },
    ]) {
      expect(PlanRequestSchema.safeParse({ ...base, ...over }).success).toBe(
        false,
      );
    }
  });
});
