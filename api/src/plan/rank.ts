import { z } from "zod";
import type { Candidate } from "./filters.ts";

export const RankOutput = z.object({
  picks: z
    .array(z.object({ candidateId: z.string(), summary: z.string() }))
    .min(2)
    .max(3),
});
export type RankOutput = z.infer<typeof RankOutput>;

type RankCandidate = {
  id: string;
  name: string;
  types: string[];
  rating?: number;
  distanceKm: number;
  matchedPreferences: number;
};

type RankInput = {
  title: string;
  preferences: { label: string; count: number }[];
  candidates: RankCandidate[];
};

export type RankerResponse = {
  output: unknown;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
};

export type Ranker = {
  model: string;
  rank(input: RankInput, rejected: string[]): Promise<RankerResponse>;
};

type Ranked = {
  picks: RankOutput["picks"];
  ranker: "model" | "code";
  attempt: number;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  ms: number;
  error?: string;
};

export const systemPrompt = [
  "You help a group of friends choose a place for an outing.",
  "You get the outing title, the group's preferences with how many people chose each, and candidate places that already fit everyone's constraints.",
  "Pick two or three candidates, best first, by how well they fit this group's preferences; use distance and rating to break ties.",
  "For each pick write one or two short sentences on why it fits this group, using only the facts given.",
  "Never mention prices, budgets, cost or anything not listed. Use each candidate's id exactly as given.",
].join(" ");

export function rankInputFor(
  title: string,
  preferences: { label: string; count: number }[],
  candidates: Candidate[],
): RankInput {
  return {
    title,
    preferences,
    candidates: candidates.map((c) => ({
      id: c.place.id,
      name: c.place.name,
      types: c.place.types,
      rating: c.place.rating,
      distanceKm: c.distanceKm,
      matchedPreferences: c.matchedPreferences,
    })),
  };
}

export function promptFor(input: RankInput): string {
  return JSON.stringify(input, null, 2);
}

const moneyWords =
  /\$|\bbudget|\bprice|\bpricey|\bafford|\bcheap|\bcost|\bdollar|\bbucks|\b(in)?expensive|\d+\s?pp\b/i;

function checkPicks(
  output: unknown,
  allowed: Set<string>,
  names: string[],
): { picks: RankOutput["picks"] } | { problem: string } {
  // A venue called "Price Chopper" is a name, not a price mention.
  const mentionsMoney = (summary: string) =>
    moneyWords.test(
      names
        .filter(Boolean)
        .reduce((rest, name) => rest.split(name).join(" "), summary),
    );
  const parsed = RankOutput.safeParse(output);
  if (!parsed.success)
    return {
      problem:
        "the answer must be an object with 2 or 3 picks, each with candidateId and summary",
    };
  const { picks } = parsed.data;
  const ids = picks.map((p) => p.candidateId);
  const unknown = ids.find((id) => !allowed.has(id));
  if (unknown !== undefined)
    return { problem: `candidateId ${unknown} is not one of the candidates` };
  if (new Set(ids).size !== ids.length)
    return { problem: "each candidateId may appear only once" };
  const bad = picks.find(
    (p) =>
      p.summary.length < 1 ||
      p.summary.length > 200 ||
      mentionsMoney(p.summary),
  );
  if (bad)
    return {
      problem: `the summary for ${bad.candidateId} must be 1 to 200 characters and must not mention prices or budgets`,
    };
  return { picks };
}

export async function rankCandidates(
  input: RankInput,
  ranker: Ranker,
): Promise<Ranked> {
  const started = performance.now();
  const allowed = new Set(input.candidates.map((c) => c.id));
  const names = input.candidates.map((c) => c.name);
  const rejected: string[] = [];
  let attempt = 0;
  let stopReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let error: string | undefined;

  while (attempt < 3) {
    attempt += 1;
    let response: RankerResponse;
    try {
      response = await ranker.rank(input, rejected);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      break;
    }
    stopReason = response.stopReason;
    inputTokens += response.inputTokens;
    outputTokens += response.outputTokens;
    const checked = checkPicks(response.output, allowed, names);
    const ms = Math.round(performance.now() - started);
    if ("picks" in checked)
      return {
        picks: checked.picks,
        ranker: "model",
        attempt,
        stopReason,
        inputTokens,
        outputTokens,
        ms,
      };
    rejected.push(checked.problem);
  }

  return {
    picks: input.candidates
      .slice(0, 3)
      .map((c) => ({ candidateId: c.id, summary: "" })),
    ranker: "code",
    attempt,
    stopReason,
    inputTokens,
    outputTokens,
    ms: Math.round(performance.now() - started),
    error: error ?? rejected.at(-1),
  };
}
