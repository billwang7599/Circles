import { z } from "zod";
import type { FilterMode } from "./filters.ts";
import type { DaySpec, PartOfDay } from "./when.ts";

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
