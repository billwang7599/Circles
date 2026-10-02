import { z } from "zod";
import { TimeWindowSchema } from "./window.ts";

/** A group member's own constraints. Draft shape: the Circles data model is not final. */
export const UserSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  /** Time blocks when the user is NOT available. Free time is derived from these. */
  unavailable: z.array(TimeWindowSchema),
  /** Maximum spend per person, in the group's currency units. */
  budget: z.number().nonnegative(),
  /** Farthest the user will travel, in km. */
  maxDistanceKm: z.number().positive(),
});

export type User = z.infer<typeof UserSchema>;
