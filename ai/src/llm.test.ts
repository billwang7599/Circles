import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, test } from "vitest";
import { LlmClient, type RankCandidate } from "./llm.ts";

const modelReturning = (json: unknown) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(json) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 1,
          noCache: 1,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });

const candidate = (id: string): RankCandidate => ({
  id,
  name: `Place ${id}`,
  location: { lat: 0, lng: 0 },
  source: "fake",
  distanceKm: 1.234,
  unmet: [],
});

describe("LlmClient", () => {
  test("rank returns the picks and sends the ask and only the given candidates", async () => {
    const model = modelReturning({
      picks: [{ candidateId: "a", rationale: "Good fit." }],
    });
    const out = await new LlmClient(model).rank({
      text: "cheap ramen",
      candidates: [candidate("a"), candidate("b")],
      n: 1,
    });
    expect(out).toEqual([{ candidateId: "a", rationale: "Good fit." }]);
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("cheap ramen");
    expect(prompt).toContain("Place a");
    expect(prompt).toContain("Place b");
    // Distance is shown rounded, so the ranker can prefer closer places.
    expect(prompt).toContain("distanceKm");
    expect(prompt).toContain("1.2");
  });

  test("output that does not match the schema throws", async () => {
    const model = modelReturning({ picks: [{ candidateId: "a" }] }); // rationale missing
    await expect(
      new LlmClient(model).rank({
        text: "x",
        candidates: [candidate("a")],
        n: 1,
      }),
    ).rejects.toThrow();
  });

  test("onUsage reports the call, token counts and time", async () => {
    const reports: unknown[] = [];
    const model = modelReturning({
      picks: [{ candidateId: "a", rationale: "ok" }],
    });
    await new LlmClient(model, { onUsage: (u) => reports.push(u) }).rank({
      text: "x",
      candidates: [candidate("a")],
      n: 1,
    });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      call: "rank",
      inputTokens: 1,
      outputTokens: 1,
    });
    expect(typeof (reports[0] as { ms: number }).ms).toBe("number");
  });
});
