import { MockLanguageModelV4 } from "ai/test";
import {
  CITIES,
  type Candidate,
  type LatLng,
  type OpeningPeriod,
} from "@circles/shared";
import type { RankCandidate } from "./llm.ts";
import type { RestaurantClient, RestaurantQuery } from "./restaurants.ts";

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
export class FakeRestaurantClient implements RestaurantClient {
  constructor(private readonly places: FakePlace[] = DEFAULT_PLACES) {}

  async search(q: RestaurantQuery): Promise<Candidate[]> {
    // Like a real search, narrow by a cuisine word in the query when there is one.
    const lower = q.query?.toLowerCase() ?? "";
    const cuisine = KNOWN_CUISINES.find((c) => lower.includes(c));
    return this.places
      .filter((p) => !cuisine || p.cuisines?.includes(cuisine))
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
  /** Replace what the fake model answers for the rank call. Receives the candidates and n. */
  rank?: (candidates: RankCandidate[], n: number) => unknown;
  /** Replace what the fake model answers for the interpret call. Receives the whole prompt. */
  interpret?: (prompt: string) => unknown;
}

const DAY_WORDS: [RegExp, string][] = [
  [/\bsunday\b/, "sunday"],
  [/\bmonday\b/, "monday"],
  [/\btuesday\b/, "tuesday"],
  [/\bwednesday\b/, "wednesday"],
  [/\bthursday\b/, "thursday"],
  [/\bfriday\b/, "friday"],
  [/\bsaturday\b/, "saturday"],
  [/\btoday\b/, "today"],
  [/\btomorrow\b/, "tomorrow"],
  [/\bweekend\b/, "weekend"],
  [/\bweekdays?\b/, "weekdays"],
];

/**
 * A rule-based stand-in for reading a change request. It understands a handful of plain
 * phrasings, enough to run and test the chat without a model. Returns the same list of
 * edits the real model does.
 */
function fakeInterpret(prompt: string): {
  edits: { field: string; value: string }[];
} {
  const message = (/Message: (.*)/.exec(prompt)?.[1] ?? "").toLowerCase();
  const budget = Number(
    /Current budget per person: ([\d.]+)/.exec(prompt)?.[1] ?? 0,
  );
  const edits: { field: string; value: string }[] = [];
  const add = (field: string, value: string | number) =>
    edits.push({ field, value: String(value) });

  const query =
    /(?:find|look for|search for)\s+(?:specifically\s+)?(.+?)(?=\s+instead of|\s+on\s|\s+with\s|\s+in\s|,|\.|$)/.exec(
      message,
    ) ?? /specifically\s+(.+?)(?=,|\.|$)/.exec(message);
  if (query?.[1]) add("query", query[1].trim());

  if (/\bany (day|time)\b/.test(message)) add("clearWhen", "true");
  for (const [re, day] of DAY_WORDS) if (re.test(message)) add("days", day);
  const parts = ["morning", "afternoon", "evening"].filter((p) =>
    message.includes(p),
  );
  if (/\bdinner\b/.test(message) && !parts.includes("evening"))
    parts.push("evening");
  for (const p of parts) add("partsOfDay", p);

  const amount =
    /\$\s*(\d+)|(\d+)\s*(?:dollars|bucks)|budget (?:of|to) (\d+)/.exec(message);
  if (amount) add("budgetPerPerson", amount[1] ?? amount[2] ?? amount[3]!);
  else if (
    /(increase|higher|bigger|raise|more).{0,12}budget|budget.{0,12}(up|higher)/.test(
      message,
    )
  )
    add("budgetPerPerson", Math.round(budget * 1.5));
  else if (/(lower|smaller|less|cut).{0,12}budget/.test(message))
    add("budgetPerPerson", Math.round(budget * 0.5));

  const km = /(\d+)\s*km/.exec(message);
  if (km) add("radiusKm", km[1]!);

  const city = CITIES.find((c) =>
    new RegExp(`\\bin ${c.name.toLowerCase()}\\b`).test(message),
  );
  if (city) add("cityId", city.id);

  const filterWords: [string, RegExp][] = [
    ["budgetMode", /budget|price/],
    ["openHoursMode", /open|hours|time/],
    ["partySizeMode", /group size|party|fits/],
    ["areaMode", /location|distance|close|near/],
  ];
  for (const [field, re] of filterWords) {
    const hit = new RegExp(
      `(?:make|keep|set)\\s+(?:the\\s+)?(?:${re.source})\\w*\\s+(?:a\\s+)?(must|requirement|preference|optional|flexible)`,
    ).exec(message);
    if (hit) add(field, /must|requirement/.test(hit[1]!) ? "hard" : "prefer");
  }
  return { edits };
}

/** A model response carrying `answer` as JSON text. */
const reply = (answer: unknown) => ({
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
});

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
 * planner (through LlmClient) runs with no API key. It ranks by rating. Overrides let a
 * test script bad or unusual answers.
 */
export function createFakeLlmModel(overrides: FakeLlmOverrides = {}) {
  return new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      const text = userText(prompt);
      if (!text.includes("\nCandidates:\n")) {
        const answer = overrides.interpret
          ? overrides.interpret(text)
          : fakeInterpret(text);
        return reply(answer);
      }
      const candidates = JSON.parse(
        text.slice(text.indexOf("\nCandidates:\n") + "\nCandidates:\n".length),
      ) as RankCandidate[];
      const n = Number(/Pick up to (\d+)/.exec(text)?.[1] ?? 3);
      const answer = overrides.rank
        ? overrides.rank(candidates, n)
        : {
            // Fewest unmet preferences, then nearest, then better rated: the order the
            // real prompt asks for.
            picks: [...candidates]
              .sort(
                (a, b) =>
                  a.unmet.length - b.unmet.length ||
                  a.distanceKm - b.distanceKm ||
                  (b.rating ?? 0) - (a.rating ?? 0),
              )
              .slice(0, n)
              .map((c) => ({
                candidateId: c.id,
                rationale: `${c.name} is ${c.distanceKm.toFixed(1)} km away and rated ${c.rating ?? "unrated"}.`,
              })),
          };
      return reply(answer);
    },
  });
}
