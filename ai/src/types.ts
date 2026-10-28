import { z } from "zod";
import { isValidTimeZone, parseInstant } from "./time.ts";

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

const isInstant = (iso: string) => {
  try {
    parseInstant(iso);
    return true;
  } catch {
    return false;
  }
};

const instant = z
  .string()
  .refine(isInstant, "must be a UTC ISO 8601 instant ending in Z");

/** Half-open interval [start, end). Both are UTC ISO 8601 instants ending in "Z". See time.ts. */
export const TimeWindowSchema = z
  .object({ start: instant, end: instant })
  .refine(
    // Field checks may have failed already but this still runs, so guard it.
    (w) =>
      !isInstant(w.start) ||
      !isInstant(w.end) ||
      parseInstant(w.end) > parseInstant(w.start),
    "end must be after start",
  );

export type TimeWindow = z.infer<typeof TimeWindowSchema>;

/**
 * Where a person is. For now they pick a city; later this comes from their live position
 * (lat and lng from the device, timezone looked up from them).
 */
export const LocationSchema = z.object({
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** IANA zone. Opening hours and free time are read in this zone. */
  timezone: z.string().refine(isValidTimeZone, "must be a valid IANA timezone"),
});
export type Location = z.infer<typeof LocationSchema>;

export interface City {
  id: string;
  name: string;
  /** IANA zone. Opening hours and "Saturday evening" are read in this zone. */
  timezone: string;
  center: LatLng;
}

export const CITIES: City[] = [
  {
    id: "toronto",
    name: "Toronto",
    timezone: "America/Toronto",
    center: { lat: 43.6532, lng: -79.3832 },
  },
  {
    id: "vancouver",
    name: "Vancouver",
    timezone: "America/Vancouver",
    center: { lat: 49.2827, lng: -123.1207 },
  },
  {
    id: "new-york",
    name: "New York",
    timezone: "America/New_York",
    center: { lat: 40.7128, lng: -74.006 },
  },
  {
    id: "san-francisco",
    name: "San Francisco",
    timezone: "America/Los_Angeles",
    center: { lat: 37.7749, lng: -122.4194 },
  },
  {
    id: "london",
    name: "London",
    timezone: "Europe/London",
    center: { lat: 51.5074, lng: -0.1278 },
  },
];

export const cityLocation = (city: City): Location => ({
  name: city.name,
  lat: city.center.lat,
  lng: city.center.lng,
  timezone: city.timezone,
});

export function findCity(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
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

/** Local start-hour ranges: morning 8-11, afternoon 12-16, evening 17-21. */
export const PARTS_OF_DAY = ["morning", "afternoon", "evening"] as const;
export type PartOfDay = (typeof PARTS_OF_DAY)[number];

/** Narrows when the group meets. Empty or missing means any time everyone is free. */
export const WhenSchema = z.object({
  days: z.array(z.enum(DAY_SPECS)).optional(),
  partsOfDay: z.array(z.enum(PARTS_OF_DAY)).optional(),
});
export type When = z.infer<typeof WhenSchema>;

/** A group member's own constraints. Draft shape: the Circles data model is not final. */
export const UserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  /** Time blocks when the user is NOT available. Free time is derived from these. */
  unavailable: z.array(TimeWindowSchema),
  /** Where the person is. Defaults the search area when they make a plan. */
  location: LocationSchema,
  /** Maximum spend per person, in the group's currency units. */
  budget: z.number().nonnegative(),
});

export type User = z.infer<typeof UserSchema>;

export const GroupContextSchema = z.object({
  members: z.array(UserSchema).min(1),
  preferences: z.array(z.string()).optional(),
  history: z.unknown().optional(),
});
export type GroupContext = z.infer<typeof GroupContextSchema>;

/** Farthest search radius. Google Places biases a search to at most 50 km. */
export const MAX_RADIUS_KM = 50;
export const DEFAULT_RADIUS_KM = 15;

export const PlanRequestSchema = z.object({
  /** What to search for, as the group typed it. */
  text: z.string().min(1),
  group: GroupContextSchema,
  /** Where to look. Its time zone is the one opening hours and mealtimes are read in. */
  location: LocationSchema,
  /** How far from the location to look, in km. */
  radiusKm: z.number().positive().max(MAX_RADIUS_KM).default(DEFAULT_RADIUS_KM),
  /** For each filter, whether it must be met or only preferred. */
  filterModes: FilterModesSchema.prefault({}),
  /** Limit to certain days or times of day. Missing means any time everyone is free. */
  when: WhenSchema.optional(),
  /** Overrides the group budget, which is otherwise the lowest member budget. */
  budgetPerPerson: z.number().nonnegative().optional(),
});
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
  "cityId",
  "budgetMode",
  "openHoursMode",
  "partySizeMode",
  "areaMode",
] as const;

export const PlanEditsSchema = z.object({
  edits: z.array(z.object({ field: z.enum(EDIT_FIELDS), value: z.string() })),
});
export type PlanEdits = z.infer<typeof PlanEditsSchema>;

/**
 * A change to a plan, built by code from the model's edits. A missing field means "leave
 * it as it is".
 */
export interface PlanPatch {
  /** The full new search text, such as "hotpot" or "seafood buffet". */
  query?: string;
  when?: { days?: DaySpec[]; partsOfDay?: PartOfDay[] };
  /** True only if they ask for any day or any time. */
  clearWhen?: boolean;
  budgetPerPerson?: number;
  radiusKm?: number;
  /** A city id. Unknown ids are ignored when applied. */
  cityId?: string;
  filterModes?: Partial<
    Record<"budget" | "openHours" | "partySize" | "area", FilterMode>
  >;
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
  availableTimes: TimeWindow[];
  /** How far the place is from the search location, in km. Closer places rank higher. */
  distanceKm: number;
  /** Filters set to "prefer" that this place does not meet. Empty means it meets them all. */
  unmet: FilterName[];
}

export type PlanStage = "searching" | "ranking";
