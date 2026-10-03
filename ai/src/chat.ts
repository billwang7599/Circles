import {
  CITIES,
  FILTER_NAMES,
  DAY_SPECS,
  MAX_RADIUS_KM,
  PARTS_OF_DAY,
  PlanEditsSchema,
  PlanRequestSchema,
  cityLocation,
  findCity,
  type DaySpec,
  type PartOfDay,
  type PlanEdits,
  type PlanPatch,
  type PlanRequest,
  type When,
} from "@circles/shared";
import type { LlmClient } from "./llm.ts";
import { validated } from "./validated.ts";

const LABELS = {
  budget: "Budget",
  openHours: "Open hours",
  partySize: "Group size",
  area: "Location",
} as const;

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function describeWhen(when: When | undefined): string {
  const days = when?.days ?? [];
  const parts = when?.partsOfDay ?? [];
  if (days.length === 0 && parts.length === 0) return "any time";
  return [days.map(titleCase).join(" or "), parts.join(" or ")]
    .filter(Boolean)
    .join(", ");
}

/** The budget the plan is using now: the planner's override, or the lowest member budget. */
export const effectiveBudget = (request: PlanRequest): number =>
  request.budgetPerPerson ??
  Math.min(...request.group.members.map((m) => m.budget));

export interface ChangeResult {
  request: PlanRequest;
  /** Plain-language lines describing what changed, written in code, not by the model. */
  changes: string[];
}

/**
 * Apply a chat patch to a plan. Pure and checked: the model only proposes values, and
 * this decides what actually changes and describes it. Unknown cities and no-op values
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
  // explicit clearWhen removes the limit, and only a non-empty list changes it.
  const newDays = patch.when?.days?.length ? patch.when.days : undefined;
  const newParts = patch.when?.partsOfDay?.length
    ? patch.when.partsOfDay
    : undefined;
  // A day or part of the day asked for wins over a stray clearWhen.
  const clear = patch.clearWhen && !newDays && !newParts;
  if (clear || newDays || newParts) {
    const days = clear ? [] : (newDays ?? request.when?.days ?? []);
    const partsOfDay = clear
      ? []
      : (newParts ?? request.when?.partsOfDay ?? []);
    const when: When | undefined =
      days.length || partsOfDay.length ? { days, partsOfDay } : undefined;
    if (describeWhen(when) !== describeWhen(request.when)) {
      if (when) next.when = when;
      else delete next.when;
      changes.push(`When: ${describeWhen(when)}`);
    }
  }

  if (patch.budgetPerPerson != null) {
    const before = effectiveBudget(request);
    if (patch.budgetPerPerson !== before) {
      next.budgetPerPerson = patch.budgetPerPerson;
      changes.push(
        `Budget: $${patch.budgetPerPerson} per person, was $${before}`,
      );
    }
  }

  if (patch.radiusKm != null && patch.radiusKm !== request.radiusKm) {
    next.radiusKm = patch.radiusKm;
    changes.push(`Radius: ${patch.radiusKm} km, was ${request.radiusKm} km`);
  }

  if (patch.cityId) {
    const city = findCity(patch.cityId);
    if (city && city.name !== request.location.name) {
      next.location = cityLocation(city);
      changes.push(`Location: ${city.name}, was ${request.location.name}`);
    }
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
  const parts: PartOfDay[] = [];
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
        const part = v.toLowerCase() as PartOfDay;
        if (!PARTS_OF_DAY.includes(part))
          throw new Error(`not a part of the day: ${value}`);
        parts.push(part);
        break;
      }
      case "clearWhen":
        if (v.toLowerCase() === "true") patch.clearWhen = true;
        break;
      case "budgetPerPerson":
        patch.budgetPerPerson = Math.round(numberOf(v, "budget"));
        break;
      case "radiusKm": {
        const km = numberOf(v, "radius");
        if (km <= 0 || km > MAX_RADIUS_KM)
          throw new Error(`radius out of range: ${value}`);
        patch.radiusKm = km;
        break;
      }
      case "cityId":
        if (v) patch.cityId = v.toLowerCase();
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
    patch.when = {
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
          budgetPerPerson: effectiveBudget(request),
          radiusKm: request.radiusKm,
          location: request.location.name,
          when: describeWhen(request.when),
        },
        cities: CITIES.map((c) => ({ id: c.id, name: c.name })),
      }),
    (raw) => editsToPatch(raw as PlanEdits),
    "interpret",
  );
  return { patch, ...applyPatch(request, patch) };
}
