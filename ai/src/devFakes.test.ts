import { describe, expect, test } from "vitest";
import { FakeRestaurantClient, createFakeLlmModel } from "./devFakes.ts";
import { LlmClient, RankedPickSchema } from "./llm.ts";

const center = { lat: 43.65, lng: -79.38 };

describe("FakeRestaurantClient", () => {
  test("returns candidates around the center", async () => {
    const found = await new FakeRestaurantClient().search({
      center,
      radiusKm: 5,
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((c) => Math.abs(c.location.lat - center.lat) < 1)).toBe(
      true,
    );
    expect(new Set(found.map((c) => c.id)).size).toBe(found.length);
  });
  test("narrows by a cuisine word in the query, otherwise returns everything", async () => {
    const italian = await new FakeRestaurantClient().search({
      center,
      radiusKm: 5,
      query: "Italian dinner",
    });
    expect(italian.length).toBeGreaterThan(0);
    expect(italian.every((c) => c.cuisines?.includes("italian"))).toBe(true);
    const anything = await new FakeRestaurantClient().search({
      center,
      radiusKm: 5,
      query: "something nice",
    });
    expect(anything.length).toBeGreaterThan(italian.length);
  });
});

describe("fake LLM model through LlmClient", () => {
  const llm = new LlmClient(createFakeLlmModel());
  test("rank returns at most n picks from the given candidates, nearest first", async () => {
    const found = await new FakeRestaurantClient().search({
      center,
      radiusKm: 5,
    });
    // Distances 0, 2, 4, ... in the order found, so the first candidate is nearest.
    const candidates = found.map((c, i) => ({
      ...c,
      distanceKm: i * 2,
      unmet: [],
    }));
    const picks = await llm.rank({ text: "dinner", candidates, n: 3 });
    expect(picks).toHaveLength(3);
    picks.forEach((p) => RankedPickSchema.parse(p));
    expect(
      picks.every((p) => candidates.some((c) => c.id === p.candidateId)),
    ).toBe(true);
    expect(picks.map((p) => p.candidateId)).toEqual(
      candidates.slice(0, 3).map((c) => c.id),
    );
  });
});
