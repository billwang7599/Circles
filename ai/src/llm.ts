import { TimeWindowSchema, type Candidate } from "@circles/shared";
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

/** What the LLM extracts from the free-text ask. Hard constraints like budget are not its job. */
export const ParsedRequestSchema = z.object({
  cuisine: z.string().optional(),
  partySize: z.number().int().positive().optional(),
  window: TimeWindowSchema.optional(),
});
export type ParsedRequest = z.infer<typeof ParsedRequestSchema>;

export interface ParseInput {
  text: string;
  /** Current UTC instant. The model does not know today's date. */
  now: string;
  timezone: string;
}

export const RankedPickSchema = z.object({
  candidateId: z.string(),
  rationale: z.string().min(1),
});
export type RankedPick = z.infer<typeof RankedPickSchema>;

export interface RankInput {
  text: string;
  /** Candidates that already passed every hard filter. */
  candidates: Candidate[];
  n: number;
}

const PARSE_SYSTEM = `You extract facts from a group's request for a restaurant outing.
Only extract what the request actually says. Leave a field out when it is not stated; never guess.
- cuisine: a single lowercase cuisine word, if one is named.
- partySize: only if the request states a number of people.
- window: only if the request names a date or time. Resolve it relative to the given current time and timezone, and return start and end as UTC ISO 8601 instants ending in Z.`;

const RANK_SYSTEM = `You pick restaurants for a group from a list of candidates and explain each pick.
Rules:
- Pick at most the requested number, best fit first.
- candidateId must be copied exactly from the list. Never invent a place or an id.
- Each rationale is one or two short sentences. Use only facts shown in the candidate data. Do not claim anything about opening hours, prices or capacity that is not in the data.`;

// Wrapped in an object because some providers require the top-level schema to be an object.
const RankOutputSchema = z.object({ picks: z.array(RankedPickSchema) });

/**
 * The planner's LLM client, backed by the Vercel AI SDK. Pass any AI SDK language model, so the
 * provider is the caller's choice. Output is schema-constrained here and validated
 * again by planEvent.
 */
export class LlmClient {
  constructor(private readonly model: LanguageModel) {}

  async parse({ text, now, timezone }: ParseInput): Promise<ParsedRequest> {
    const { output } = await generateText({
      model: this.model,
      temperature: 0,
      system: PARSE_SYSTEM,
      prompt: `Current time (UTC): ${now}\nTimezone: ${timezone}\nRequest: ${text}`,
      output: Output.object({ schema: ParsedRequestSchema }),
    });
    return output;
  }

  async rank({ text, candidates, n }: RankInput): Promise<RankedPick[]> {
    const list = candidates.map((c) => ({
      id: c.id,
      name: c.name,
      cuisines: c.cuisines,
      priceLevel: c.priceLevel,
      rating: c.rating,
    }));
    const { output } = await generateText({
      model: this.model,
      temperature: 0,
      system: RANK_SYSTEM,
      prompt: `Request: ${text}\nPick up to ${n}.\nCandidates:\n${JSON.stringify(list, null, 2)}`,
      output: Output.object({ schema: RankOutputSchema }),
    });
    return output.picks;
  }
}
