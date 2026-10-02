import { z } from "zod";
import { parseInstant } from "../time.ts";

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
