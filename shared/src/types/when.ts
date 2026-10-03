import { z } from "zod";

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
