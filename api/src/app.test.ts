import { describe, expect, test } from "vitest";
import { createApp } from "./app.js";

const app = createApp();
const post = (body: unknown) =>
  app.request("/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const member = {
  id: "u",
  name: "U",
  budget: 40,
  maxDistanceKm: 10,
  unavailable: [],
};
const group = {
  city: "toronto",
  timezone: "America/Toronto",
  members: [member],
};

describe("POST /plan", () => {
  test("returns options from the planner", async () => {
    const res = await post({ text: "dinner", group });
    expect(res.status).toBe(200);
    const body = await res.json();
    // The result is either options or a clear no-match, depending on the clock.
    expect(["ok", "no_matches"]).toContain(body.status);
  });
  test("rejects an invalid body", async () => {
    expect((await post({ text: "dinner" })).status).toBe(400);
    expect((await post({ text: "", group })).status).toBe(400);
    const res = await app.request("/plan", {
      method: "POST",
      body: "not json",
    });
    expect(res.status).toBe(400);
  });
  test("rejects an unknown city", async () => {
    expect(
      (await post({ text: "dinner", group: { ...group, city: "atlantis" } }))
        .status,
    ).toBe(400);
  });
  test("health check", async () => {
    expect((await app.request("/health")).status).toBe(200);
  });
});
