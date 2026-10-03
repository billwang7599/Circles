import { z } from "zod";
import { LocationSchema } from "./city.ts";
import { TimeWindowSchema } from "./window.ts";

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
