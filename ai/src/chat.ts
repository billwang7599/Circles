import { AREAS, Part, areaById } from "@circles/shared";
import {
  FILTER_NAMES,
  DAY_SPECS,
  MAX_RADIUS_KM,
  PlanEditsSchema,
  PlanRequestSchema,
  type DaySpec,
  type PlanEdits,
  type PlanPatch,
  type PlanRequest,
  type TimeFilter,
} from "./types.ts";
import { effectiveBudgetCents } from "./constraints.ts";
import type { LlmClient } from "./llm.ts";
import { validated } from "./validated.ts";

const LABELS = {
  budget: "Budget",
  openHours: "Open hours",
  partySize: "Group size",
  area: "Location",
} as const;

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function describeTimeFilter(filter: TimeFilter | undefined): string {
  const days = filter?.days ?? [];
  const parts = filter?.partsOfDay ?? [];
  if (days.length === 0 && parts.length === 0) return "any time";
  return [days.map(titleCase).join(" or "), parts.join(" or ")]
    .filter(Boolean)
    .join(", ");
}

const dollars = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

export interface ChangeResult {
  request: PlanRequest;
  /** Plain-language lines describing what changed, written in code, not by the model. */
  changes: string[];
}

/**
 * Apply a chat patch to a plan. Pure and checked: the model only proposes values, and
 * this decides what actually changes and describes it. Unknown areas and no-op values
 * are ignored, so the list of changes is always true.
 */
export function applyPatch(
  request: PlanRequest,
  patch: PlanPatch,
): ChangeResult {
  const next: PlanRequest = structuredClone(request);
  const changes: string[] = [];

  const query = patch.query?.trim();
  if (query && query !== request.text) {
    next.text = query;
    changes.push(`Searching for "${query}" instead of "${request.text}"`);
  }

  // An empty list is not an instruction: models fill unused fields with [], so only an
  // explicit clear removes the limit, and only a non-empty list changes it.
  const newDays = patch.timeFilter?.days?.length
    ? patch.timeFilter.days
    : undefined;
  const newParts = patch.timeFilter?.partsOfDay?.length
    ? patch.timeFilter.partsOfDay
    : undefined;
  // A day or part of the day asked for wins over a stray clear.
  const clear = patch.clearTimeFilter && !newDays && !newParts;
  if (clear || newDays || newParts) {
    const days = clear ? [] : (newDays ?? request.timeFilter?.days ?? []);
    const partsOfDay = clear
      ? []
      : (newParts ?? request.timeFilter?.partsOfDay ?? []);
    const filter: TimeFilter | undefined =
      days.length || partsOfDay.length ? { days, partsOfDay } : undefined;
    if (describeTimeFilter(filter) !== describeTimeFilter(request.timeFilter)) {
      if (filter) next.timeFilter = filter;
      else delete next.timeFilter;
      changes.push(`When: ${describeTimeFilter(filter)}`);
    }
  }

  if (patch.budgetCents != null) {
    const before = effectiveBudgetCents(request);
    if (patch.budgetCents !== before) {
      next.budgetCents = patch.budgetCents;
      changes.push(
        `Budget: ${dollars(patch.budgetCents)} per person, was ${dollars(before)}`,
      );
    }
  }

  if (patch.radiusKm != null && patch.radiusKm !== request.radiusKm) {
    next.radiusKm = patch.radiusKm;
    changes.push(`Radius: ${patch.radiusKm} km, was ${request.radiusKm} km`);
  }

  const area = AREAS.find((a) => a.id === patch.areaId);
  if (area && area.id !== request.areaId) {
    next.areaId = area.id;
    changes.push(
      `Location: ${area.name}, was ${areaById(request.areaId).name}`,
    );
  }

  for (const name of FILTER_NAMES) {
    const mode = patch.filterModes?.[name];
    if (mode && mode !== request.filterModes[name]) {
      next.filterModes[name] = mode;
      changes.push(
        `${LABELS[name]} is now ${mode === "hard" ? "a must-have" : "a preference"}`,
      );
    }
  }

  return { request: PlanRequestSchema.parse(next), changes };
}

const MODE_FIELDS = {
  budgetMode: "budget",
  openHoursMode: "openHours",
  partySizeMode: "partySize",
  areaMode: "area",
} as const;

function numberOf(value: string, what: string): number {
  const n = Number(value.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0)
    throw new Error(`${what} is not a number: ${value}`);
  return n;
}

/**
 * Turn the model's edits into a patch, checking every value. Anything that is not a
 * known value throws, so the model is asked again instead of a guess being applied.
 */
export function editsToPatch(raw: PlanEdits): PlanPatch {
  const patch: PlanPatch = {};
  const days: DaySpec[] = [];
  const parts: Part[] = [];
  for (const { field, value } of PlanEditsSchema.parse(raw).edits) {
    const v = value.trim();
    switch (field) {
      case "query":
        if (v) patch.query = v;
        break;
      case "days": {
        const day = v.toLowerCase() as DaySpec;
        if (!DAY_SPECS.includes(day)) throw new Error(`not a day: ${value}`);
        days.push(day);
        break;
      }
      case "partsOfDay": {
        const part = Part.safeParse(v.toLowerCase());
        if (!part.success) throw new Error(`not a part of the day: ${value}`);
        parts.push(part.data);
        break;
      }
      case "clearWhen":
        if (v.toLowerCase() === "true") patch.clearTimeFilter = true;
        break;
      case "budgetPerPerson":
        // The model speaks dollars.
        patch.budgetCents = Math.round(numberOf(v, "budget") * 100);
        break;
      case "radiusKm": {
        const km = numberOf(v, "radius");
        if (km <= 0 || km > MAX_RADIUS_KM)
          throw new Error(`radius out of range: ${value}`);
        patch.radiusKm = km;
        break;
      }
      case "areaId":
        if (v) patch.areaId = v.toLowerCase();
        break;
      default: {
        const mode = v.toLowerCase();
        if (mode !== "hard" && mode !== "prefer")
          throw new Error(`not a mode: ${value}`);
        patch.filterModes = {
          ...patch.filterModes,
          [MODE_FIELDS[field]]: mode,
        } as PlanPatch["filterModes"];
      }
    }
  }
  if (days.length || parts.length) {
    patch.timeFilter = {
      ...(days.length ? { days } : {}),
      ...(parts.length ? { partsOfDay: parts } : {}),
    };
  }
  return patch;
}

export interface ChatChange extends ChangeResult {
  patch: PlanPatch;
}

/**
 * Read a chat message as a change to a plan. The model's answer is validated and
 * retried like any other, then applied by code. Throws PlannerError if it never
 * returns a usable answer.
 */
export async function changePlan(
  request: PlanRequest,
  message: string,
  llm: LlmClient,
): Promise<ChatChange> {
  const patch = await validated(
    () =>
      llm.interpret({
        message,
        current: {
          query: request.text,
          budgetDollars: effectiveBudgetCents(request) / 100,
          radiusKm: request.radiusKm,
          location: areaById(request.areaId).name,
          when: describeTimeFilter(request.timeFilter),
        },
        areas: AREAS.map((a) => ({ id: a.id, name: a.name })),
      }),
    (raw) => editsToPatch(raw as PlanEdits),
    "interpret",
  );
  return { patch, ...applyPatch(request, patch) };
}
