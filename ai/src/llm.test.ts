import type { Candidate } from "@circles/shared";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, test } from "vitest";
import { LlmClient } from "./llm.ts";

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

const candidate = (id: string): Candidate => ({
  id,
  name: `Place ${id}`,
  location: { lat: 0, lng: 0 },
  source: "fake",
});

describe("LlmClient", () => {
  test("parse returns the structured output and sends now, timezone and the ask", async () => {
    const model = modelReturning({ cuisine: "ramen", partySize: 4 });
    const out = await new LlmClient(model).parse({
      text: "ramen for 4",
      now: "2026-10-03T15:00:00Z",
      timezone: "America/Toronto",
    });
    expect(out).toEqual({ cuisine: "ramen", partySize: 4 });
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("2026-10-03T15:00:00Z");
    expect(prompt).toContain("America/Toronto");
    expect(prompt).toContain("ramen for 4");
  });

  test("rank returns the picks and sends only the given candidates", async () => {
    const model = modelReturning({
      picks: [{ candidateId: "a", rationale: "Good fit." }],
    });
    const out = await new LlmClient(model).rank({
      text: "dinner",
      candidates: [candidate("a"), candidate("b")],
      n: 1,
    });
    expect(out).toEqual([{ candidateId: "a", rationale: "Good fit." }]);
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("Place a");
    expect(prompt).toContain("Place b");
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
});
