import { z } from "zod";
import { isValidTimeZone } from "../time.ts";
import { UserSchema } from "./user.ts";

export const GroupContextSchema = z.object({
  /** City id, see city.ts. */
  city: z.string().min(1),
  /** IANA zone, e.g. "America/Toronto". */
  timezone: z.string().refine(isValidTimeZone, "must be a valid IANA timezone"),
  members: z.array(UserSchema).min(1),
  preferences: z.array(z.string()).optional(),
  history: z.unknown().optional(),
});
export type GroupContext = z.infer<typeof GroupContextSchema>;

export const PlanRequestSchema = z.object({
  text: z.string().min(1),
  group: GroupContextSchema,
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
