import type { PlanRequest, User } from "@circles/shared";
import { describe, expect, test } from "vitest";
import {
  FakePlacesClient,
  createFakeLlmModel,
  type FakeLlmOverrides,
} from "./fakes.js";
import { LlmClient } from "./llm.js";
import { PlannerError, planEvent, type PlanDeps } from "./plan.js";

// Saturday 2026-10-03 11:00 local (Toronto, EDT).
const NOW = new Date("2026-10-03T15:00:00Z");

const user = (over: Partial<User> = {}): User => ({
  id: "u",
  name: "U",
  budget: 40,
  maxDistanceKm: 10,
  unavailable: [],
  ...over,
});
const request = (members: User[], text = "dinner"): PlanRequest => ({
  text,
  group: { city: "toronto", timezone: "America/Toronto", members },
});
const deps = (overrides: FakeLlmOverrides = {}): PlanDeps => ({
  llm: new LlmClient(createFakeLlmModel(overrides)),
  places: new FakePlacesClient(),
  now: () => NOW,
});

describe("planEvent", () => {
  test("returns options that all come from the filtered candidates", async () => {
    const r = await planEvent(request([user(), user({ id: "v" })]), deps());
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.options).toHaveLength(3);
    const passed = new Set(r.candidates.map((c) => c.id));
    expect(r.options.every((o) => passed.has(o.candidateId))).toBe(true);
    expect(
      r.options.every((o) => o.rationale && o.constraintChecks.length > 0),
    ).toBe(true);
  });

  test("no returned option violates a known hard constraint", async () => {
    // Budget 10 allows price level 1 at most; one-star-high places must not appear.
    const r = await planEvent(request([user({ budget: 10 })]), deps());
    if (r.status !== "ok") throw new Error("expected ok");
    for (const c of r.candidates) {
      if (c.priceLevel !== undefined)
        expect(c.priceLevel).toBeLessThanOrEqual(1);
    }
  });

  test("respects a cuisine in the request", async () => {
    const r = await planEvent(request([user()], "ramen dinner"), deps());
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.candidates.every((c) => c.cuisines?.includes("ramen"))).toBe(true);
  });

  test("party size comes from the request when larger than the group", async () => {
    const r = await planEvent(request([user()], "dinner for 9"), deps());
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.fields.partySize).toBe(9);
    // Places that seat fewer than 9 are filtered out (known capacity only).
    expect(
      r.candidates.every(
        (c) => c.maxPartySize === undefined || c.maxPartySize >= 9,
      ),
    ).toBe(true);
  });

  test("unverified data is labelled in the constraint checks", async () => {
    const r = await planEvent(request([user()]), deps());
    if (r.status !== "ok") throw new Error("expected ok");
    const unknownPrice = r.candidates.find((c) => c.priceLevel === undefined);
    if (unknownPrice) {
      const opt = r.options.find((o) => o.candidateId === unknownPrice.id);
      if (opt) expect(opt.constraintChecks.join(" ")).toContain("unverified");
    }
  });

  test("no time when everyone is free gives a clear no-match", async () => {
    const wholeRange = {
      start: "2026-10-03T00:00:00Z",
      end: "2026-10-20T00:00:00Z",
    };
    const r = await planEvent(
      request([user({ unavailable: [wholeRange] })]),
      deps(),
    );
    expect(r).toMatchObject({ status: "no_matches", reason: "no_free_time" });
  });

  test("names the constraint that eliminated the most candidates", async () => {
    const r = await planEvent(request([user({ maxDistanceKm: 0.05 })]), deps());
    expect(r).toMatchObject({ status: "no_matches", reason: "distance" });
  });

  test("a cuisine with no places gives no_places", async () => {
    const r = await planEvent(
      request([user()], "french dinner"),
      deps({ parse: () => ({ cuisine: "nonexistent" }) }),
    );
    expect(r).toMatchObject({ status: "no_matches", reason: "no_places" });
  });
});

describe("planEvent guards against bad model output", () => {
  test("rejects a hallucinated candidate id and retries", async () => {
    let calls = 0;
    const r = await planEvent(
      request([user()]),
      deps({
        rank: (candidates) => {
          calls++;
          if (calls === 1) {
            return {
              picks: [
                { candidateId: "made-up-place", rationale: "Great vibes" },
              ],
            };
          }
          return {
            picks: [{ candidateId: candidates[0]!.id, rationale: "Fine." }],
          };
        },
      }),
    );
    expect(calls).toBe(2);
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.options.every((o) => o.candidateId !== "made-up-place")).toBe(
      true,
    );
  });

  test("throws PlannerError if the model never returns valid picks", async () => {
    await expect(
      planEvent(
        request([user()]),
        deps({
          rank: () => ({
            picks: [{ candidateId: "made-up-place", rationale: "x" }],
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(PlannerError);
  });

  test("rejects a place that exists but failed the filters", async () => {
    // fake-5 (price level 4) is over a low budget, so it is not in the filtered set.
    await expect(
      planEvent(
        request([user({ budget: 10 })]),
        deps({
          rank: () => ({
            picks: [{ candidateId: "fake-5", rationale: "Fancy" }],
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(PlannerError);
  });

  test("rejects duplicate picks and malformed output", async () => {
    await expect(
      planEvent(
        request([user()]),
        deps({
          rank: () => ({
            picks: [
              { candidateId: "fake-1", rationale: "a" },
              { candidateId: "fake-1", rationale: "b" },
            ],
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(PlannerError);
    await expect(
      planEvent(request([user()]), deps({ rank: () => "nope" })),
    ).rejects.toBeInstanceOf(PlannerError);
  });

  test("retries an invalid parse, then throws PlannerError", async () => {
    await expect(
      planEvent(request([user()]), deps({ parse: () => ({ partySize: -2 }) })),
    ).rejects.toBeInstanceOf(PlannerError);
  });

  test("a parsed window outside everyone's free time is rejected", async () => {
    const blocked = {
      start: "2026-10-03T22:00:00Z",
      end: "2026-10-04T02:00:00Z",
    };
    const r = await planEvent(
      request([user({ unavailable: [blocked] })]),
      deps({
        parse: () => ({
          window: {
            start: "2026-10-03T23:00:00Z",
            end: "2026-10-04T01:00:00Z",
          },
        }),
      }),
    );
    expect(r).toMatchObject({ status: "no_matches", reason: "no_free_time" });
  });
});
