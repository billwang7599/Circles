import { z } from "zod";
import { LocationSchema } from "./city.ts";
import { FilterModesSchema } from "./filters.ts";
import { UserSchema } from "./user.ts";

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
  /** For each filter, whether it must be met or only preferred. See filters.ts for the defaults. */
  filterModes: FilterModesSchema.prefault({}),
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
