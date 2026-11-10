import {
  PlanEditsSchema,
  type Candidate,
  type FilterName,
  type PlanEdits,
  type WebMention,
} from "./types.ts";
import {
  generateText,
  isStepCount,
  NoOutputGeneratedError,
  Output,
  tool,
  type LanguageModel,
  type LanguageModelUsage,
} from "ai";
import { z } from "zod";
import type { WebClient } from "./webSearch.ts";

export const MAX_WEB_SEARCHES = 5;
export const MAX_PAGE_READS = 5;
export const MAX_WEB_PLACES = 5;
const MAX_SNIPPET_CHARS = 1000;
const MAX_PAGE_CHARS = 4000;
// Reddit and Google forbid scraping; the others need a login or JavaScript.
const UNREADABLE_HOSTS =
  /(^|\.)(reddit\.com|redd\.it|google\.[a-z.]+|tiktok\.com|instagram\.com|facebook\.com)$/;

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
- Some candidates have web: what locals say about the place online (Reddit, TikTok, blogs). It is a strong reason to pick a place, most of all when the request asks for something trending, popular or a hidden gem. Say what the place is known for in its rationale.
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
- areaId: an area id from the list, only if they ask to search somewhere else.
- budgetMode, openHoursMode, partySizeMode, areaMode: "hard" if it must hold, "prefer" if it is only a preference or can be flexible. budget is price, openHours is open when the group is free, partySize is fits the group, area is close to the location.

Example (current budget 20): "find hotpot instead of buffet, on sunday, with a bigger budget" gives {"edits":[{"field":"query","value":"hotpot"},{"field":"days","value":"sunday"},{"field":"budgetPerPerson","value":"30"}]}`;

const RESEARCH_SYSTEM = `You find restaurants, cafes and bars for a group by searching the web for what locals recommend: Reddit threads, TikTok, food blogs and local news. Look for places that are trending, loved or a hidden gem, not just the big chains.
Rules:
- Only places in or near the given area. Put the area or city in every search.
- You have at most ${MAX_WEB_SEARCHES} searches and ${MAX_PAGE_READS} page reads; fewer is fine. Read a page only when its snippet suggests it lists places worth knowing. Reddit, Google, TikTok, Instagram and Facebook pages cannot be read; use their snippets.
- Answer with up to ${MAX_WEB_PLACES} places, best first, by the exact name the place goes by. For each, a note of one short sentence on what the pages say about it, and the URLs of the search results that mention it.
- Never invent a place, a note or a URL. If nothing fits, answer with an empty list.`;

// Wrapped in an object because some providers require the top-level schema to be an object.
const RankOutputSchema = z.object({ picks: z.array(RankedPickSchema) });

const ResearchOutputSchema = z.object({
  places: z.array(
    z.object({
      name: z.string().min(1),
      note: z.string().min(1),
      sourceUrls: z.array(z.string()),
    }),
  ),
});

/**
 * The planner's LLM client, backed by the Vercel AI SDK. Pass any AI SDK language model, so the
 * provider is the caller's choice. Output is schema-constrained here and validated
 * again by planEvent.
 */
export interface LlmUsage {
  call: "rank" | "interpret" | "research";
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  /** Hidden thinking tokens, when the model reports them. They count as output. */
  reasoningTokens: number | undefined;
  ms: number;
  web?: { searches: number; pageReads: number; errors: string[] };
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
    budgetDollars: number;
    radiusKm: number;
    location: string;
    when: string;
  };
  areas: { id: string; name: string }[];
}

export interface ResearchInput {
  text: string;
  where: string;
  today: string;
  web: WebClient;
}

export interface WebPlace extends WebMention {
  name: string;
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
    web?: LlmUsage["web"],
  ) {
    this.options.onUsage?.({
      call,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.outputTokenDetails.reasoningTokens,
      ms: Date.now() - started,
      ...(web ? { web } : {}),
    });
  }

  async research({
    text,
    where,
    today,
    web,
  }: ResearchInput): Promise<WebPlace[]> {
    const titles = new Map<string, string>();
    const counts = { searches: 0, pageReads: 0, errors: [] as string[] };
    const tools = {
      webSearch: tool({
        description:
          "Search the web. Returns pages with a title, URL and the passages that match.",
        inputSchema: z.object({ query: z.string().min(1) }),
        execute: async ({ query }) => {
          if (counts.searches >= MAX_WEB_SEARCHES)
            return "No searches left. Answer with what you have.";
          counts.searches++;
          const results = await web.search(query);
          for (const r of results) titles.set(r.url, r.title);
          return results.map((r) => ({
            ...r,
            text: r.text.slice(0, MAX_SNIPPET_CHARS),
          }));
        },
      }),
      readPage: tool({
        description: "Read the text of a page that a search returned.",
        inputSchema: z.object({ url: z.string() }),
        execute: async ({ url }) => {
          if (!titles.has(url))
            return "Only pages a search returned can be read.";
          if (UNREADABLE_HOSTS.test(new URL(url).hostname))
            return "This site can't be read. Use its search snippet.";
          if (counts.pageReads >= MAX_PAGE_READS)
            return "No page reads left. Answer with what you have.";
          counts.pageReads++;
          return (await web.read(url)).slice(0, MAX_PAGE_CHARS);
        },
      }),
    };

    const started = Date.now();
    const result = await generateText({
      model: this.model,
      temperature: 0,
      system: RESEARCH_SYSTEM,
      prompt: `Request: ${text}\nArea: ${where}\nToday: ${today}`,
      tools,
      // Room for every search and read one at a time, plus the answer.
      stopWhen: isStepCount(MAX_WEB_SEARCHES + MAX_PAGE_READS + 2),
      output: Output.object({ schema: ResearchOutputSchema }),
    });
    for (const step of result.steps) {
      for (const part of step.content) {
        if (part.type === "tool-error")
          counts.errors.push(
            part.error instanceof Error
              ? part.error.message
              : String(part.error),
          );
      }
    }
    this.report("research", started, result.totalUsage, counts);

    let places: z.infer<typeof ResearchOutputSchema>["places"];
    try {
      places = result.output.places;
    } catch (e) {
      if (NoOutputGeneratedError.isInstance(e)) return [];
      throw e;
    }
    return places
      .flatMap(({ name, note, sourceUrls }) => {
        const sources = [...new Set(sourceUrls)]
          .filter((url) => titles.has(url))
          .map((url) => ({ title: titles.get(url)!, url }));
        return sources.length > 0 ? [{ name, note, sources }] : [];
      })
      .slice(0, MAX_WEB_PLACES);
  }

  /** Read a chat message as edits to the current plan. Code checks and applies them. */
  async interpret({
    message,
    current,
    areas,
  }: InterpretInput): Promise<PlanEdits> {
    const started = Date.now();
    const { output, usage } = await generateText({
      model: this.model,
      temperature: 0,
      system: INTERPRET_SYSTEM,
      prompt: [
        `Current search: ${current.query}`,
        `Current budget per person: ${current.budgetDollars}`,
        `Current radius km: ${current.radiusKm}`,
        `Current location: ${current.location}`,
        `Current when: ${current.when}`,
        `Areas: ${JSON.stringify(areas)}`,
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
      web: c.web?.note,
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
