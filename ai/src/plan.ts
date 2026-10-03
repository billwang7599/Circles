import {
  PlanRequestSchema,
  type Candidate,
  type FilterModes,
  type FilterName,
  type PlanOption,
  type PlanRequest,
  type PlanStage,
  type SearchFields,
} from "@circles/shared";
import { z } from "zod";
import {
  availableTimes,
  generateSlots,
  type SlotOptions,
} from "./availability.ts";
import { deriveConstraints } from "./constraints.ts";
import { applyFilters, distanceKm, unverifiedFilters } from "./filters.ts";
import {
  RankedPickSchema,
  type LlmClient,
  type RankCandidate,
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
  /** Meeting length and the hours considered. See SlotOptions for the defaults. */
  slots?: SlotOptions;
  /** Called as the pipeline moves between steps, so callers can show progress. */
  onProgress?: (stage: PlanStage) => void;
}

export type NoMatchReason = "no_free_time" | "no_restaurants" | FilterName;

export type PlanResult =
  | {
      status: "ok";
      options: PlanOption[];
      candidates: Candidate[];
      /** Set when fewer places than asked for met the must-haves, and why. */
      notice?: string;
    }
  | { status: "no_matches"; reason: NoMatchReason; message: string };

/** The LLM kept returning output that failed validation. Never fall back to unchecked output. */
export class PlannerError extends Error {}

const SEARCH_DAYS = 14;
const MAX_ATTEMPTS = 3;
const DAY_MS = 24 * 3600_000;

const NO_MATCH_MESSAGES: Record<NoMatchReason, string> = {
  no_free_time:
    "No time in the next two weeks when everyone is free for a meal out.",
  no_restaurants: "No restaurants were found for that search.",
  budget: "Every place found was over the group's budget.",
  area: "Every place found was outside the search radius.",
  openHours: "Every place found was closed whenever the group is free.",
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

const FILTER_LABELS: Record<FilterName, string> = {
  budget: "Budget",
  openHours: "Opening hours",
  partySize: "Party size",
  area: "Location",
};

/**
 * Said when must-haves left fewer places than were asked for, so a short list is never a
 * mystery: how many places there were, how many met every must-have, and which must-haves
 * did the cutting. Counts are per filter alone, so they can overlap.
 */
function shortfallNotice(
  found: number,
  passed: number,
  rejectedBy: Record<FilterName, number>,
  modes: FilterModes,
): string {
  const causes = (Object.keys(rejectedBy) as FilterName[])
    .filter((name) => modes[name] === "hard" && rejectedBy[name] > 0)
    .sort((a, b) => rejectedBy[b] - rejectedBy[a])
    .map((name) => `${FILTER_LABELS[name]} rules out ${rejectedBy[name]}`);
  const head = `Only ${passed} of ${found} places met every must-have.`;
  return causes.length > 0
    ? `${head} ${causes.join(", ")}. Switch a filter to Prefer to see more.`
    : head;
}

function describeChecks(
  c: RankCandidate,
  f: SearchFields,
  modes: FilterModes,
): string[] {
  const unverified = new Set(unverifiedFilters(c, f));
  const unmet = new Set(c.unmet);
  const tag = (name: FilterName) =>
    modes[name] === "prefer" ? " (preferred)" : "";
  const checks: string[] = [];

  if (f.maxPriceLevel !== undefined) {
    checks.push(
      unverified.has("budget")
        ? "Budget: unverified (no price data)"
        : unmet.has("budget")
          ? `Budget${tag("budget")}: over price level ${f.maxPriceLevel}, not met`
          : `Budget${tag("budget")}: within price level ${f.maxPriceLevel}`,
    );
  }
  checks.push(
    unverified.has("openHours")
      ? "Open hours: unverified (no hours data)"
      : unmet.has("openHours")
        ? `Open hours${tag("openHours")}: not open when the group is free, not met`
        : `Open hours${tag("openHours")}: open when the group is free`,
  );
  checks.push(
    unverified.has("partySize")
      ? "Party size: unverified (capacity unknown)"
      : unmet.has("partySize")
        ? `Party size${tag("partySize")}: seats fewer than ${f.partySize}, not met`
        : `Party size${tag("partySize")}: fits ${f.partySize}`,
  );
  if (f.area) {
    checks.push(
      unmet.has("area")
        ? `Location${tag("area")}: ${Math.round(c.distanceKm * 10) / 10} km away, outside the ${f.area.radiusKm} km radius, not met`
        : `Location${tag("area")}: within ${f.area.radiusKm} km`,
    );
  }
  return checks;
}

/**
 * Derive constraints -> fetch and filter -> rank and explain. Everything the group's
 * data already says (party size, budget, distance, free time) is worked out in code.
 * The LLM only picks among candidates that already passed, and explains why.
 */
export async function planEvent(
  rawRequest: PlanRequest,
  deps: PlanDeps,
  { n = 3, slots: slotOptions, onProgress }: PlanOptions = {},
): Promise<PlanResult> {
  const request = PlanRequestSchema.parse(rawRequest);
  const { group, location, radiusKm, filterModes } = request;
  const center = { lat: location.lat, lng: location.lng };
  const now = (deps.now ?? (() => new Date()))();
  const constraints = deriveConstraints(group, {
    start: now.toISOString(),
    end: new Date(now.getTime() + SEARCH_DAYS * DAY_MS).toISOString(),
  });

  // Opening hours and mealtimes are read in the search location's time zone. Members'
  // own zones only matter when they enter times, which are stored as UTC.
  const slots = generateSlots(
    constraints.freeWindows,
    location.timezone,
    slotOptions,
  );
  if (slots.length === 0) return noMatches("no_free_time");

  const fields: SearchFields = {
    query: request.text,
    partySize: constraints.partySize,
    slots,
    maxPriceLevel: constraints.maxPriceLevel,
    area: { center, radiusKm },
  };

  // 1. Fetch and filter (plain code)
  onProgress?.("searching");
  const found = await deps.restaurants.search({
    center,
    radiusKm,
    query: request.text,
  });
  if (found.length === 0) return noMatches("no_restaurants");

  const { passed, unmet, rejectedBy, mostRestrictive } = applyFilters(
    found,
    fields,
    filterModes,
  );
  if (passed.length === 0)
    return noMatches(mostRestrictive ?? "no_restaurants");

  // Order by how well each place meets the preferences: fewest unmet first, then nearer,
  // then better rated. Preferred filters never drop a place, they only move it down.
  const ranked: RankCandidate[] = passed
    .map((c) => ({
      ...c,
      distanceKm: distanceKm(center, c.location),
      unmet: unmet[c.id] ?? [],
    }))
    .sort(
      (a, b) =>
        a.unmet.length - b.unmet.length ||
        a.distanceKm - b.distanceKm ||
        (b.rating ?? 0) - (a.rating ?? 0),
    );

  // 2. Rank and explain (LLM). Every pick must be a distinct candidate that passed.
  onProgress?.("ranking");
  const allowed = new Set(passed.map((c) => c.id));
  const picks: RankedPick[] = await validated(
    () => deps.llm.rank({ text: request.text, candidates: ranked, n }),
    (raw) => {
      const list = z.array(RankedPickSchema).parse(raw);
      // Places passed the filters, so an empty answer is a bad answer, not "nothing fits".
      if (list.length === 0) throw new Error("no picks returned");
      const ids = list.map((p) => p.candidateId);
      if (ids.some((id) => !allowed.has(id)))
        throw new Error("pick is not a filtered candidate");
      if (new Set(ids).size !== ids.length) throw new Error("duplicate pick");
      return list.slice(0, n);
    },
    "rank",
  );

  const byId = new Map(ranked.map((c) => [c.id, c]));
  const options: PlanOption[] = picks.map((p) => {
    const candidate = byId.get(p.candidateId)!;
    return {
      candidateId: p.candidateId,
      rationale: p.rationale,
      constraintChecks: describeChecks(candidate, fields, filterModes),
      availableTimes: availableTimes(candidate, slots),
      distanceKm: Math.round(candidate.distanceKm * 10) / 10,
      unmet: candidate.unmet,
    };
  });

  const notice =
    passed.length < n
      ? shortfallNotice(found.length, passed.length, rejectedBy, filterModes)
      : undefined;

  return {
    status: "ok",
    options,
    candidates: ranked,
    ...(notice ? { notice } : {}),
  };
}
