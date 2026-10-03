import {
  PlanEditsSchema,
  type Candidate,
  type FilterName,
  type PlanEdits,
} from "@circles/shared";
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

const INTERPRET_SYSTEM = `You turn a chat message into a list of edits to a restaurant search plan. Output one edit for each thing the message asks to change. A message can ask for several changes, so list them all. If it asks for no change, return an empty list. Never guess.

Fields and values:
- query: the FULL new search text, such as "hotpot" or "seafood buffet". "find hotpot instead of buffet" gives "hotpot". A refinement such as "specifically seafood buffet" gives "seafood buffet".
- days: one day word: sunday, monday, tuesday, wednesday, thursday, friday, saturday, today, tomorrow, weekend, weekdays. One edit per day. Use the day words the person said. Never work out dates.
- partsOfDay: morning, afternoon or evening. One edit per part.
- clearWhen: "true" only if they say any day or any time.
- budgetPerPerson: dollars as a number string. For "increase, raise or bigger budget" with no amount, use 1.5 times the current budget. For lower, use 0.5 times.
- radiusKm: kilometres as a number string.
- cityId: a city id from the list, only if they ask to search somewhere else.
- budgetMode, openHoursMode, partySizeMode, areaMode: "hard" if it must hold, "prefer" if it is only a preference or can be flexible. budget is price, openHours is open when the group is free, partySize is fits the group, area is close to the location.

Example (current budget 20): "find hotpot instead of buffet, on sunday, with a bigger budget" gives {"edits":[{"field":"query","value":"hotpot"},{"field":"days","value":"sunday"},{"field":"budgetPerPerson","value":"30"}]}`;

// Wrapped in an object because some providers require the top-level schema to be an object.
const RankOutputSchema = z.object({ picks: z.array(RankedPickSchema) });

/**
 * The planner's LLM client, backed by the Vercel AI SDK. Pass any AI SDK language model, so the
 * provider is the caller's choice. Output is schema-constrained here and validated
 * again by planEvent.
 */
export interface LlmUsage {
  call: "rank" | "interpret";
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

/** What the interpreter needs to know to read a change request. */
export interface InterpretInput {
  message: string;
  current: {
    query: string;
    budgetPerPerson: number;
    radiusKm: number;
    location: string;
    when: string;
  };
  cities: { id: string; name: string }[];
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

  /** Read a chat message as edits to the current plan. Code checks and applies them. */
  async interpret({
    message,
    current,
    cities,
  }: InterpretInput): Promise<PlanEdits> {
    const started = Date.now();
    const { output, usage } = await generateText({
      model: this.model,
      temperature: 0,
      system: INTERPRET_SYSTEM,
      prompt: [
        `Current search: ${current.query}`,
        `Current budget per person: ${current.budgetPerPerson}`,
        `Current radius km: ${current.radiusKm}`,
        `Current location: ${current.location}`,
        `Current when: ${current.when}`,
        `Cities: ${JSON.stringify(cities)}`,
        `Message: ${message}`,
      ].join("\n"),
      output: Output.object({ schema: PlanEditsSchema }),
    });
    this.report("interpret", started, usage);
    return output;
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
