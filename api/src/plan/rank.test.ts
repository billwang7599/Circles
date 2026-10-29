import { areaById } from "@circles/shared";
import { expect, test } from "vitest";
import { constraintsFor } from "./constraints.ts";
import { fakePlaceList } from "./fakes.ts";
import { filterPlaces } from "./filters.ts";
import {
  promptFor,
  rankCandidates,
  rankInputFor,
  type RankOutput,
  type Ranker,
} from "./rank.ts";
import { slotsIn } from "./slots.ts";

const area = areaById("uw");
const constraints = constraintsFor(
  [
    { budgetCents: 12345, busy: [], preferences: ["ramen"] },
    {
      budgetCents: 67890,
      busy: [{ date: "2026-11-07", part: "morning" }],
      preferences: ["sushi", "bar"],
    },
  ],
  {
    windowStart: "2026-11-06",
    windowEnd: "2026-11-07",
    timezone: area.timezone,
  },
  new Date("2026-11-06T13:00:00.000Z"),
);
const { candidates } = filterPlaces(fakePlaceList, {
  priceCap: constraints.priceCap,
  slots: slotsIn(constraints.freeWindows, area.timezone),
  area,
  preferenceTypes: constraints.preferenceTypes,
});
const input = rankInputFor(
  "Friday dinner",
  constraints.preferences,
  candidates,
);
const [first, second, third] = input.candidates;

const good: RankOutput = {
  picks: [
    { candidateId: first.id, summary: "Closest to campus with ramen." },
    { candidateId: second.id, summary: "Highly rated and nearby." },
  ],
};

function scripted(outputs: unknown[]): Ranker & { rejections: string[][] } {
  const rejections: string[][] = [];
  return {
    model: "scripted",
    rejections,
    async rank(_input, rejected) {
      rejections.push([...rejected]);
      return {
        output: outputs[rejections.length - 1],
        stopReason: "end_turn",
        inputTokens: 10,
        outputTokens: 5,
      };
    },
  };
}

test.each([
  {
    problem: "an unknown candidate id",
    output: {
      picks: [
        { candidateId: "ChIJnowhere00000000000000000", summary: "Unknown." },
        good.picks[1],
      ],
    },
    message: /not one of the candidates/,
  },
  {
    problem: "a duplicate candidate id",
    output: {
      picks: [good.picks[0], { ...good.picks[1], candidateId: first.id }],
    },
    message: /only once/,
  },
  {
    problem: "a money word in a summary",
    output: {
      picks: [
        { candidateId: first.id, summary: "Cheap and close to campus." },
        good.picks[1],
      ],
    },
    message: /prices or budgets/,
  },
  {
    problem: "a single pick",
    output: { picks: [good.picks[0]] },
    message: /2 or 3 picks/,
  },
])(
  "$problem is rejected and the model is asked again",
  async ({ output, message }) => {
    const ranker = scripted([output, good]);
    const ranked = await rankCandidates(input, ranker);
    expect(ranked).toMatchObject({
      ranker: "model",
      attempt: 2,
      picks: good.picks,
    });
    expect(ranker.rejections[1][0]).toMatch(message);
  },
);

test("a venue whose name contains a money word is not a price mention", async () => {
  const named = {
    ...input,
    candidates: input.candidates.map((c) =>
      c.id === first.id ? { ...c, name: "Price Chopper Deli" } : c,
    ),
  };
  const ranker = scripted([
    {
      picks: [
        { candidateId: first.id, summary: "Price Chopper Deli is closest." },
        good.picks[1],
      ],
    },
  ]);
  const ranked = await rankCandidates(named, ranker);
  expect(ranked).toMatchObject({ ranker: "model", attempt: 1 });
});

test("after three failed attempts the code ordering is used without summaries", async () => {
  const single = { picks: [good.picks[0]] };
  const ranker = scripted([single, single, single]);
  const ranked = await rankCandidates(input, ranker);
  expect(ranker.rejections).toHaveLength(3);
  expect(ranked).toMatchObject({
    ranker: "code",
    attempt: 3,
    picks: [first, second, third].map((c) => ({
      candidateId: c.id,
      summary: "",
    })),
  });
});

test("a ranker that cannot be reached falls back to the code ordering at once", async () => {
  const ranker: Ranker = {
    model: "unreachable",
    rank: async () => {
      throw new Error("connect ECONNREFUSED");
    },
  };
  const ranked = await rankCandidates(input, ranker);
  expect(ranked).toMatchObject({ ranker: "code", attempt: 1 });
  expect(ranked.picks.every((p) => p.summary === "")).toBe(true);
});

test("the prompt carries no budget, price, member name or busy time", () => {
  const prompt = promptFor(input);
  expect(prompt).not.toMatch(/budget|price|cents|\$/i);
  expect(prompt).not.toMatch(
    /\b12345\b|\b67890\b|2026-11-07|morning|afternoon|evening/,
  );
  expect(Object.keys(first).sort()).toEqual([
    "distanceKm",
    "id",
    "matchedPreferences",
    "name",
    "rating",
    "types",
  ]);
});
