import { z } from "zod";

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
