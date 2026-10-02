import { MockLanguageModelV4 } from "ai/test";
import type { PlacesClient, PlacesQuery } from "./places.ts";
import type { Candidate, LatLng, OpeningPeriod } from "@circles/shared";

/** Open every day from openH to closeH local time. closeH above 24 wraps past midnight. */
const daily = (openH: number, closeH: number): OpeningPeriod[] =>
  Array.from({ length: 7 }, (_, d) => ({
    openMin: d * 1440 + openH * 60,
    closeMin: d * 1440 + closeH * 60,
  }));

interface FakePlace extends Omit<Candidate, "location" | "source"> {
  /** Offset from the search center in degrees (about 0.01 = 1 km). */
  offset: LatLng;
}

const DEFAULT_PLACES: FakePlace[] = [
  {
    id: "fake-1",
    name: "Noodle House",
    priceLevel: 1,
    rating: 4.4,
    cuisines: ["ramen", "japanese"],
    openingHours: daily(11, 22),
    maxPartySize: 8,
    offset: { lat: 0.005, lng: 0.005 },
  },
  {
    id: "fake-2",
    name: "Trattoria Roma",
    priceLevel: 3,
    rating: 4.7,
    cuisines: ["italian"],
    openingHours: daily(17, 23),
    maxPartySize: 12,
    offset: { lat: 0.01, lng: -0.01 },
  },
  {
    id: "fake-3",
    name: "Taco Corner",
    priceLevel: 1,
    rating: 4.1,
    cuisines: ["mexican"],
    openingHours: daily(11, 26),
    maxPartySize: 6,
    offset: { lat: -0.02, lng: 0.01 },
  },
  {
    id: "fake-4",
    name: "Green Bowl",
    priceLevel: 2,
    rating: 4.3,
    cuisines: ["vegetarian", "vegan"],
    openingHours: daily(10, 20),
    maxPartySize: 10,
    offset: { lat: 0.03, lng: 0.02 },
  },
  {
    id: "fake-5",
    name: "Le Bistro",
    priceLevel: 4,
    rating: 4.8,
    cuisines: ["french"],
    openingHours: daily(18, 23),
    maxPartySize: 4,
    offset: { lat: -0.01, lng: -0.02 },
  },
  {
    id: "fake-6",
    name: "Spice Route",
    priceLevel: 2,
    rating: 4.5,
    cuisines: ["indian"],
    openingHours: daily(12, 22),
    offset: { lat: 0.015, lng: 0.015 },
  },
  {
    id: "fake-7",
    name: "Mystery Diner",
    rating: 3.9,
    cuisines: ["american"],
    offset: { lat: -0.005, lng: 0.02 },
  },
  {
    id: "fake-8",
    name: "Far Out Pizza",
    priceLevel: 2,
    rating: 4.2,
    cuisines: ["italian", "pizza"],
    openingHours: daily(12, 23),
    maxPartySize: 20,
    offset: { lat: 0.2, lng: 0.2 },
  },
];

/** Canned places positioned around the search center. Filters by cuisine and radius like a real search would. */
export class FakePlacesClient implements PlacesClient {
  constructor(private readonly places: FakePlace[] = DEFAULT_PLACES) {}

  async search(q: PlacesQuery): Promise<Candidate[]> {
    return this.places
      .filter(
        (p) => !q.cuisine || p.cuisines?.includes(q.cuisine.toLowerCase()),
      )
      .map(({ offset, ...p }) => ({
        ...p,
        location: {
          lat: q.center.lat + offset.lat,
          lng: q.center.lng + offset.lng,
        },
        source: "fake",
      }));
  }
}

const KNOWN_CUISINES = [
  "ramen",
  "japanese",
  "italian",
  "mexican",
  "vegetarian",
  "vegan",
  "french",
  "indian",
  "pizza",
];

export interface FakeLlmOverrides {
  /** Replace what the fake model answers for the parse call. Receives the request text. */
  parse?: (text: string) => unknown;
  /** Replace what the fake model answers for the rank call. Receives the candidates and n. */
  rank?: (candidates: Candidate[], n: number) => unknown;
}

/** Text of the last user message sent to the model. */
function userText(prompt: unknown): string {
  const messages = prompt as { role: string; content: unknown }[];
  const user = [...messages].reverse().find((m) => m.role === "user");
  const parts = user?.content as { type: string; text?: string }[] | string;
  return typeof parts === "string"
    ? parts
    : (parts ?? []).map((p) => p.text ?? "").join("");
}

/**
 * A deterministic stand-in for a real model, built on the AI SDK's mock model, so the
 * planner (through LlmClient) runs with no API key. Parse matches cuisine keywords and
 * "for N"; rank orders by rating. Overrides let a test script bad or unusual answers.
 */
export function createFakeLlmModel(overrides: FakeLlmOverrides = {}) {
  return new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      const text = userText(prompt);
      let answer: unknown;
      if (text.includes("\nCandidates:\n")) {
        const candidates = JSON.parse(
          text.slice(
            text.indexOf("\nCandidates:\n") + "\nCandidates:\n".length,
          ),
        ) as Candidate[];
        const n = Number(/Pick up to (\d+)/.exec(text)?.[1] ?? 3);
        answer = overrides.rank
          ? overrides.rank(candidates, n)
          : {
              picks: [...candidates]
                .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
                .slice(0, n)
                .map((c) => ({
                  candidateId: c.id,
                  rationale: `${c.name} is rated ${c.rating ?? "unrated"}.`,
                })),
            };
      } else {
        const request = /Request: (.*)/.exec(text)?.[1] ?? "";
        const lower = request.toLowerCase();
        const cuisine = KNOWN_CUISINES.find((c) => lower.includes(c));
        const size = /for (\d+)/.exec(lower);
        answer = overrides.parse
          ? overrides.parse(request)
          : {
              ...(cuisine ? { cuisine } : {}),
              ...(size ? { partySize: Number(size[1]) } : {}),
            };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(answer) }],
        finishReason: { unified: "stop" as const, raw: undefined },
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
      };
    },
  });
}
