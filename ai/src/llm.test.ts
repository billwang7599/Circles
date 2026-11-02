import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, test } from "vitest";
import {
  LlmClient,
  MAX_PAGE_READS,
  MAX_WEB_SEARCHES,
  type LlmUsage,
  type RankCandidate,
} from "./llm.ts";
import type { WebClient, WebResult } from "./webSearch.ts";

const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

const answer = (json: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(json) }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage,
  warnings: [],
});

const toolCalls = (...calls: [toolName: string, input: unknown][]) => ({
  content: calls.map(([toolName, input], i) => ({
    type: "tool-call" as const,
    toolCallId: `${toolName}-${i}-${Math.random()}`,
    toolName,
    input: JSON.stringify(input),
  })),
  finishReason: { unified: "tool-calls" as const, raw: undefined },
  usage,
  warnings: [],
});

const modelReturning = (json: unknown) =>
  new MockLanguageModelV4({ doGenerate: async () => answer(json) });

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

describe("LlmClient.research", () => {
  const GEMS: WebResult = {
    title: "Hidden gems in KW",
    url: "https://blog.example.com/gems",
    text: "Locals swear by Ajisen Ramen.",
  };

  function webReturning(results: WebResult[], page = "page text") {
    const searched: string[] = [];
    const read: string[] = [];
    const web: WebClient = {
      search: async (q) => {
        searched.push(q);
        return results;
      },
      read: async (url) => {
        read.push(url);
        return page;
      },
    };
    return { web, searched, read };
  }

  const input = (web: WebClient) => ({
    text: "hidden gem ramen",
    where: "Uptown Waterloo (43.4647, -80.5223), within 4 km",
    today: "2026-10-03",
    web,
  });

  test("lets the model search and read, then returns the places it names with the pages that cite them", async () => {
    const { web, searched, read } = webReturning(
      [GEMS],
      "Ajisen Ramen: rich broth.",
    );
    const model = new MockLanguageModelV4({
      doGenerate: [
        toolCalls(["webSearch", { query: "ramen uptown waterloo reddit" }]),
        toolCalls(["readPage", { url: GEMS.url }]),
        answer({
          places: [
            {
              name: "Ajisen Ramen",
              note: "Locals' favourite for broth.",
              sourceUrls: [GEMS.url, "https://made.up/page"],
            },
            {
              name: "Ghost Place",
              note: "x",
              sourceUrls: ["https://made.up/other"],
            },
          ],
        }),
      ],
    });
    const places = await new LlmClient(model).research(input(web));

    expect(searched).toEqual(["ramen uptown waterloo reddit"]);
    expect(read).toEqual([GEMS.url]);
    // Only pages a search returned count as sources, and a place needs at least one.
    expect(places).toEqual([
      {
        name: "Ajisen Ramen",
        note: "Locals' favourite for broth.",
        sources: [{ title: GEMS.title, url: GEMS.url }],
      },
    ]);
    const first = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(first).toContain("hidden gem ramen");
    expect(first).toContain("Uptown Waterloo");
    expect(first).toContain("2026-10-03");
    const last = JSON.stringify(model.doGenerateCalls[2]?.prompt);
    expect(last).toContain("Locals swear by Ajisen Ramen.");
    expect(last).toContain("Ajisen Ramen: rich broth.");
  });

  test("searches at most MAX_WEB_SEARCHES times, and finds nothing if the model never answers", async () => {
    const { web, searched } = webReturning([GEMS]);
    const model = new MockLanguageModelV4({
      doGenerate: async () => toolCalls(["webSearch", { query: "ramen" }]),
    });
    expect(await new LlmClient(model).research(input(web))).toEqual([]);
    expect(searched).toHaveLength(MAX_WEB_SEARCHES);
  });

  test("reads at most MAX_PAGE_READS pages, only ones a search returned, never Reddit or Google", async () => {
    const blogs = Array.from({ length: MAX_PAGE_READS + 2 }, (_, i) => ({
      title: `Blog ${i}`,
      url: `https://blog${i}.example.com/list`,
      text: "places",
    }));
    const reddit = {
      title: "r/waterloo",
      url: "https://www.reddit.com/r/waterloo/comments/1/x/",
      text: "t",
    };
    const google = {
      title: "Maps",
      url: "https://www.google.ca/maps/place/x",
      text: "t",
    };
    const { web, read } = webReturning([reddit, google, ...blogs]);
    const model = new MockLanguageModelV4({
      doGenerate: [
        toolCalls(["webSearch", { query: "ramen" }]),
        toolCalls(
          ["readPage", { url: reddit.url }],
          ["readPage", { url: google.url }],
          ["readPage", { url: "https://not.searched.example.com/" }],
          ...blogs.map((b): [string, unknown] => ["readPage", { url: b.url }]),
        ),
        answer({ places: [] }),
      ],
    });
    await new LlmClient(model).research(input(web));
    expect(read).toEqual(blogs.slice(0, MAX_PAGE_READS).map((b) => b.url));
  });

  test("reports the call with its searches, page reads and tool errors", async () => {
    const reports: LlmUsage[] = [];
    const web: WebClient = {
      search: async () => {
        throw new Error("token expired");
      },
      read: async () => "",
    };
    const model = new MockLanguageModelV4({
      doGenerate: [
        toolCalls(["webSearch", { query: "ramen" }]),
        answer({ places: [] }),
      ],
    });
    await new LlmClient(model, { onUsage: (u) => reports.push(u) }).research(
      input(web),
    );
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      call: "research",
      inputTokens: 2,
      web: { searches: 1, pageReads: 0, errors: ["token expired"] },
    });
  });
});
