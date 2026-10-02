import {
  PlanRequestSchema,
  findCity,
  parseInstant,
  type Candidate,
  type PlanOption,
  type PlanStage,
  type PlanRequest,
  type SearchFields,
  type TimeWindow,
} from "@circles/shared";
import { z } from "zod";
import { deriveConstraints } from "./constraints.ts";
import { applyFilters, unverifiedFilters, type FilterName } from "./filters.ts";
import {
  ParsedRequestSchema,
  RankedPickSchema,
  type LlmClient,
  type ParsedRequest,
  type RankedPick,
} from "./llm.ts";
import type { RestaurantClient } from "./restaurants.ts";

export interface PlanDeps {
  llm: LlmClient;
  restaurants: RestaurantClient;
  /** Injectable clock for tests. */
  now?: () => Date;
}

export interface PlanOptions {
  /** How many options to return. Default 3. */
  n?: number;
  /** Called as the pipeline moves between steps, so callers can show progress. */
  onProgress?: (stage: PlanStage) => void;
}

export type NoMatchReason = "no_free_time" | "no_restaurants" | FilterName;

export type PlanResult =
  | {
      status: "ok";
      options: PlanOption[];
      candidates: Candidate[];
      fields: SearchFields;
    }
  | { status: "no_matches"; reason: NoMatchReason; message: string };

/** The LLM kept returning output that failed validation. Never fall back to unchecked output. */
export class PlannerError extends Error {}

const SEARCH_DAYS = 14;
const DEFAULT_DURATION_MS = 2 * 3600_000;
const MAX_ATTEMPTS = 3;
const DAY_MS = 24 * 3600_000;

const NO_MATCH_MESSAGES: Record<NoMatchReason, string> = {
  no_free_time: "No time in the next two weeks when everyone is free.",
  no_restaurants: "No restaurants were found for that request.",
  budget: "Every place found was over the group's budget.",
  distance: "Every place found was farther than the group's distance limit.",
  openHours: "Every place found was closed at the chosen time.",
  partySize: "Every place found is too small for the group.",
};

const noMatches = (reason: NoMatchReason): PlanResult => ({
  status: "no_matches",
  reason,
  message: NO_MATCH_MESSAGES[reason],
});

/** Call the model, validate its output, and retry on anything invalid. */
async function validated<T>(
  call: () => Promise<unknown>,
  check: (raw: unknown) => T,
  what: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return check(await call());
    } catch (e) {
      lastError = e;
    }
  }
  throw new PlannerError(
    `${what} failed validation after ${MAX_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

const contains = (outer: TimeWindow, inner: TimeWindow) =>
  parseInstant(inner.start) >= parseInstant(outer.start) &&
  parseInstant(inner.end) <= parseInstant(outer.end);

/**
 * TODO: pick the window better. This takes the first free slot of at least two hours,
 * which can land at 3am. Better: prefer evening slots, or try several slots.
 */
function defaultWindow(free: TimeWindow[]): TimeWindow | undefined {
  const slot = free.find(
    (w) => parseInstant(w.end) - parseInstant(w.start) >= DEFAULT_DURATION_MS,
  );
  if (!slot) return undefined;
  const start = parseInstant(slot.start);
  return {
    start: slot.start,
    end: new Date(start + DEFAULT_DURATION_MS).toISOString(),
  };
}

function describeChecks(c: Candidate, f: SearchFields): string[] {
  const unverified = new Set(unverifiedFilters(c, f));
  const checks: string[] = [];
  if (f.maxPriceLevel !== undefined) {
    checks.push(
      unverified.has("budget")
        ? "Budget: unverified (no price data)"
        : `Budget: within price level ${f.maxPriceLevel}`,
    );
  }
  if (f.maxDistanceKm !== undefined)
    checks.push(`Distance: within ${f.maxDistanceKm} km`);
  if (f.window) {
    checks.push(
      unverified.has("openHours")
        ? "Open hours: unverified (no hours data)"
        : "Open hours: open for the whole window",
    );
  }
  checks.push(
    unverified.has("partySize")
      ? "Party size: unverified (capacity unknown)"
      : `Party size: fits ${f.partySize}`,
  );
  return checks;
}

/**
 * Parse -> fetch and filter -> rank and explain. Hard constraints are enforced in
 * code; the LLM only parses the ask and picks among candidates that already passed.
 */
export async function planEvent(
  rawRequest: PlanRequest,
  deps: PlanDeps,
  { n = 3, onProgress }: PlanOptions = {},
): Promise<PlanResult> {
  const request = PlanRequestSchema.parse(rawRequest);
  const { group } = request;
  const city = findCity(group.city);
  if (!city) throw new Error(`Unknown city: ${group.city}`);

  const now = (deps.now ?? (() => new Date()))();
  const range: TimeWindow = {
    start: now.toISOString(),
    end: new Date(now.getTime() + SEARCH_DAYS * DAY_MS).toISOString(),
  };
  const constraints = deriveConstraints(group, range);

  // 1. Parse (LLM)
  onProgress?.("parsing");
  const parsed: ParsedRequest = await validated(
    () =>
      deps.llm.parse({
        text: request.text,
        now: range.start,
        timezone: group.timezone,
      }),
    (raw) => ParsedRequestSchema.parse(raw),
    "parse",
  );

  // The window must sit inside a time when everyone is free.
  const window = parsed.window ?? defaultWindow(constraints.freeWindows);
  if (!window || !constraints.freeWindows.some((w) => contains(w, window))) {
    return noMatches("no_free_time");
  }

  const fields: SearchFields = {
    ...(parsed.cuisine ? { cuisine: parsed.cuisine } : {}),
    partySize: Math.max(parsed.partySize ?? 0, constraints.partySize),
    window,
    maxPriceLevel: constraints.maxPriceLevel,
    center: city.center,
    maxDistanceKm: constraints.maxDistanceKm,
  };

  // 2. Fetch and filter (plain code)
  onProgress?.("searching");
  const found = await deps.restaurants.search({
    center: city.center,
    radiusKm: constraints.maxDistanceKm,
    ...(fields.cuisine ? { cuisine: fields.cuisine } : {}),
  });
  if (found.length === 0) return noMatches("no_restaurants");

  const { passed, mostRestrictive } = applyFilters(found, fields, {
    timezone: group.timezone,
  });
  if (passed.length === 0)
    return noMatches(mostRestrictive ?? "no_restaurants");

  onProgress?.("ranking");
  // 3. Rank and explain (LLM). Every pick must be a distinct candidate that passed.
  const allowed = new Set(passed.map((c) => c.id));
  const picks: RankedPick[] = await validated(
    () => deps.llm.rank({ text: request.text, candidates: passed, n }),
    (raw) => {
      const list = z.array(RankedPickSchema).parse(raw);
      const ids = list.map((p) => p.candidateId);
      if (ids.some((id) => !allowed.has(id)))
        throw new Error("pick is not a filtered candidate");
      if (new Set(ids).size !== ids.length) throw new Error("duplicate pick");
      return list.slice(0, n);
    },
    "rank",
  );

  const byId = new Map(passed.map((c) => [c.id, c]));
  const options: PlanOption[] = picks.map((p) => ({
    candidateId: p.candidateId,
    rationale: p.rationale,
    constraintChecks: describeChecks(byId.get(p.candidateId)!, fields),
  }));

  return { status: "ok", options, candidates: passed, fields };
}
