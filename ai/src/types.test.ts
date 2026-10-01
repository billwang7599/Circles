import { expect, test } from "vitest";
import type { PlanRequest } from "./types.js";

test("scaffold runs", () => {
  const req: PlanRequest = {
    text: "dinner this weekend?",
    group: { city: "x", timezone: "UTC", budget: null, availability: null },
  };
  expect(req.group.city).toBe("x");
});
