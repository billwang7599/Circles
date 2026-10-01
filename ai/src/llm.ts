import { z } from "zod";
import { TimeWindowSchema, type Candidate } from "@circles/shared";

/** What the LLM extracts from the free-text ask. Hard constraints like budget are not its job. */
export const ParsedRequestSchema = z.object({
  cuisine: z.string().optional(),
  tags: z.array(z.string()).optional(),
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

// TODO(ai-connector): implement LlmClient with the Vercel AI SDK structured output.
export interface LlmClient {
  parse(input: ParseInput): Promise<ParsedRequest>;
  rank(input: RankInput): Promise<RankedPick[]>;
}
