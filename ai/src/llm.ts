import type { Candidate, FilterName } from "@circles/shared";
import {
  generateText,
  Output,
  type LanguageModel,
  type LanguageModelUsage,
} from "ai";
import { z } from "zod";

export const RankedPickSchema = z.object({
  candidateId: z.string(),
  rationale: z.string().min(1),
});
export type RankedPick = z.infer<typeof RankedPickSchema>;

/** A candidate with its distance from the search location and the preferences it misses. */
export interface RankCandidate extends Candidate {
  distanceKm: number;
  /** Preferred filters this place does not meet. */
  unmet: FilterName[];
}

export interface RankInput {
  text: string;
  /** Candidates that already passed every hard filter. */
  candidates: RankCandidate[];
  n: number;
}

const RANK_SYSTEM = `You pick restaurants for a group from a list of candidates and explain each pick.
Rules:
- Pick at most the requested number, best first.
- Candidates are already ordered best first by code. Each has distanceKm from the search location, and unmet: the things the group wanted but this place does not meet. Prefer places with nothing unmet, then nearer places. Only choose a worse-ordered place when it is clearly a better fit for the request or much better rated.
- candidateId must be copied exactly from the list. Never invent a place or an id.
- Each rationale is one or two short sentences. Use only facts shown in the candidate data. Do not claim anything about opening hours, prices or capacity that is not in the data.`;

// Wrapped in an object because some providers require the top-level schema to be an object.
const RankOutputSchema = z.object({ picks: z.array(RankedPickSchema) });

/**
 * The planner's LLM client, backed by the Vercel AI SDK. Pass any AI SDK language model, so the
 * provider is the caller's choice. Output is schema-constrained here and validated
 * again by planEvent.
 */
export interface LlmUsage {
  call: "rank";
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  /** Hidden thinking tokens, when the model reports them. They count as output. */
  reasoningTokens: number | undefined;
  ms: number;
}

export interface LlmClientOptions {
  /** Called after every successful model call, to log or measure token use and time. */
  onUsage?: (usage: LlmUsage) => void;
}

export class LlmClient {
  constructor(
    private readonly model: LanguageModel,
    private readonly options: LlmClientOptions = {},
  ) {}

  private report(
    call: LlmUsage["call"],
    started: number,
    usage: LanguageModelUsage,
  ) {
    this.options.onUsage?.({
      call,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.outputTokenDetails.reasoningTokens,
      ms: Date.now() - started,
    });
  }

  async rank({ text, candidates, n }: RankInput): Promise<RankedPick[]> {
    const list = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      cuisines: c.cuisines,
      priceLevel: c.priceLevel,
      rating: c.rating,
      distanceKm: Math.round(c.distanceKm * 10) / 10,
      unmet: c.unmet,
    }));
    const started = Date.now();
    const { output, usage } = await generateText({
      model: this.model,
      temperature: 0,
      system: RANK_SYSTEM,
      prompt: `Request: ${text}\nPick up to ${n}.\nCandidates:\n${JSON.stringify(list, null, 2)}`,
      output: Output.object({ schema: RankOutputSchema }),
    });
    this.report("rank", started, usage);
    return output.picks;
  }
}
