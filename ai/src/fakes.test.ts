import { describe, expect, test } from "vitest";
import { FakePlacesClient, MockLlmClient } from "./fakes.js";
import { ParsedRequestSchema, RankedPickSchema } from "./llm.js";

const center = { lat: 43.65, lng: -79.38 };

describe("FakePlacesClient", () => {
  test("returns candidates around the center", async () => {
    const found = await new FakePlacesClient().search({ center, radiusKm: 5 });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((c) => Math.abs(c.location.lat - center.lat) < 1)).toBe(
      true,
    );
    expect(new Set(found.map((c) => c.id)).size).toBe(found.length);
  });
  test("filters by cuisine", async () => {
    const found = await new FakePlacesClient().search({
      center,
      radiusKm: 5,
      cuisine: "Italian",
    });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((c) => c.cuisines?.includes("italian"))).toBe(true);
  });
});

describe("MockLlmClient", () => {
  const llm = new MockLlmClient();
  test("parse output matches the schema", async () => {
    const out = await llm.parse({
      text: "italian dinner for 5",
      now: "2026-10-01T00:00:00Z",
      timezone: "UTC",
    });
    expect(ParsedRequestSchema.parse(out)).toEqual({
      cuisine: "italian",
      partySize: 5,
    });
  });
  test("rank returns at most n picks from the given candidates, best rated first", async () => {
    const candidates = await new FakePlacesClient().search({
      center,
      radiusKm: 5,
    });
    const picks = await llm.rank({ text: "dinner", candidates, n: 3 });
    expect(picks).toHaveLength(3);
    picks.forEach((p) => RankedPickSchema.parse(p));
    expect(
      picks.every((p) => candidates.some((c) => c.id === p.candidateId)),
    ).toBe(true);
    expect(picks[0]?.candidateId).toBe("fake-5");
  });
});
