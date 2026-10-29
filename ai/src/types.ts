import {
  AreaId,
  BusyPart,
  Part,
  PreferenceId,
  RegistrationInput,
  areaById,
  type Interval,
} from "@circles/shared";
import { z } from "zod";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Candidate {
  id: string;
  name: string;
  priceLevel?: number;
  rating?: number;
  location: LatLng;
  cuisines?: string[];
  /** Open periods in the place's local time. Missing means unknown. */
  openingHours?: OpeningPeriod[];
  /** Largest party the place can seat. Missing means unknown (Places has no capacity field). */
  maxPartySize?: number;
  source: string;
}

/** Minutes from Sunday 00:00 local time. A period crossing the week end has close > 10080. */
export interface OpeningPeriod {
  openMin: number;
  closeMin: number;
}

/** The things a plan can be held to. */
export const FILTER_NAMES = [
  "budget",
  "openHours",
  "partySize",
  "area",
] as const;
export type FilterName = (typeof FILTER_NAMES)[number];

/**
 * How strictly a filter applies:
 * - "hard": a place that fails it is dropped.
 * - "prefer": a place that fails it stays, but ranks below places that meet it.
 */
export const FilterModeSchema = z.enum(["hard", "prefer"]);
export type FilterMode = z.infer<typeof FilterModeSchema>;

/** Budget, time and group size are must-haves. Location is a preference: closer is better. */
export const FilterModesSchema = z.object({
  budget: FilterModeSchema.default("hard"),
  openHours: FilterModeSchema.default("hard"),
  partySize: FilterModeSchema.default("hard"),
  area: FilterModeSchema.default("prefer"),
});
export type FilterModes = z.infer<typeof FilterModesSchema>;

export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Days a plan can be limited to. Resolved to real dates in code, never by the LLM. */
export const DAY_SPECS = [
  ...WEEKDAYS,
  "today",
  "tomorrow",
  "weekend",
  "weekdays",
] as const;
export type DaySpec = (typeof DAY_SPECS)[number];

export const TimeFilterSchema = z.object({
  days: z.array(z.enum(DAY_SPECS)).optional(),
  partsOfDay: z.array(Part).optional(),
});
export type TimeFilter = z.infer<typeof TimeFilterSchema>;

export const MemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  budgetCents: RegistrationInput.shape.budgetCents.unwrap(),
  busy: z.array(BusyPart),
  preferences: z.array(PreferenceId),
});
export type Member = z.infer<typeof MemberSchema>;

export const GroupContextSchema = z.object({
  members: z.array(MemberSchema).min(1),
  history: z.unknown().optional(),
});

/** Farthest search radius. Google Places biases a search to at most 50 km. */
export const MAX_RADIUS_KM = 50;

export const PlanRequestSchema = z
  .object({
    text: z.string().min(1),
    group: GroupContextSchema,
    areaId: AreaId,
    // Dates in the area's time zone, both included.
    windowStart: z.iso.date(),
    windowEnd: z.iso.date(),
    radiusKm: z.number().positive().max(MAX_RADIUS_KM).optional(),
    filterModes: FilterModesSchema.prefault({}),
    timeFilter: TimeFilterSchema.optional(),
    // Overrides the lowest member budget.
    budgetCents: z.int().nonnegative().optional(),
  })
  .refine((r) => r.windowEnd >= r.windowStart, {
    message: "windowEnd must not be before windowStart",
    path: ["windowEnd"],
  })
  .transform((r) => ({
    ...r,
    radiusKm: r.radiusKm ?? areaById(r.areaId).radiusKm,
  }));
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

/**
 * What the model returns when reading a change request: a flat list of edits, one per
 * thing the person asked for. Models list edits far more reliably than they fill in a
 * sparse object, which tended to drop all but one of several changes. Values are strings
 * so code can check each one strictly before anything is applied.
 */
export const EDIT_FIELDS = [
  "query",
  "days",
  "partsOfDay",
  "clearWhen",
  "budgetPerPerson",
  "radiusKm",
  "areaId",
  "budgetMode",
  "openHoursMode",
  "partySizeMode",
  "areaMode",
] as const;

export const PlanEditsSchema = z.object({
  edits: z.array(z.object({ field: z.enum(EDIT_FIELDS), value: z.string() })),
});
export type PlanEdits = z.infer<typeof PlanEditsSchema>;

export interface PlanPatch {
  query?: string;
  timeFilter?: TimeFilter;
  clearTimeFilter?: boolean;
  budgetCents?: number;
  radiusKm?: number;
  // Unknown ids are ignored when applied.
  areaId?: string;
  filterModes?: Partial<Record<FilterName, FilterMode>>;
}

/**
 * A candidate meeting time, with its start and end also read on the local clock as
 * minutes from Sunday 00:00, to compare against a place's opening hours.
 */
export interface AvailabilitySlot {
  start: string; // UTC ISO 8601, ends in Z
  end: string;
  startMin: number;
  endMin: number; // greater than startMin, so it can pass 10080 across the week end
}

/** What the filters check. All derived in code from the group, never by the LLM. */
export interface SearchFields {
  /** What to search for, as the group typed it. Passed to the places search as is. */
  query?: string;
  /** The number of people in the group. */
  partySize: number;
  /** Times when every member is free. A place must be open for at least one. */
  slots?: AvailabilitySlot[];
  maxPriceLevel?: number; // 0-4, derived from the group budget
  /** Where the group wants to be, and how far out the search looks. */
  area?: { center: LatLng; radiusKm: number };
}

export interface PlanOption {
  candidateId: string;
  rationale: string;
  constraintChecks: string[];
  /** Upcoming times when the group is free and the place is open. Empty if hours are unknown. */
  availableTimes: Interval[];
  /** How far the place is from the search location, in km. Closer places rank higher. */
  distanceKm: number;
  /** Filters set to "prefer" that this place does not meet. Empty means it meets them all. */
  unmet: FilterName[];
}

export type PlanStage = "searching" | "ranking";
