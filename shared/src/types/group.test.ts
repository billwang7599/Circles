import { describe, expect, test } from "vitest";
import { GroupContextSchema } from "./group.js";
import type { User } from "./user.js";

const user: User = {
  id: "u",
  name: "U",
  budget: 25,
  maxDistanceKm: 5,
  unavailable: [],
};
const group = (members: User[]) => ({
  city: "toronto",
  timezone: "America/Toronto",
  members,
});

describe("GroupContextSchema", () => {
  test("requires members and a valid timezone", () => {
    expect(GroupContextSchema.safeParse(group([user])).success).toBe(true);
    expect(GroupContextSchema.safeParse(group([])).success).toBe(false);
    expect(
      GroupContextSchema.safeParse({ ...group([user]), timezone: "Nope" })
        .success,
    ).toBe(false);
  });
});
