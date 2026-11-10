import { z } from "zod";
import type { EventSummary } from "./event.ts";

export const DisplayName = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(40, "At most 40 characters");

export const Email = z.email("Enter an email address");

export const AVATAR_COLORS = [
  "violet",
  "blue",
  "fern",
  "ember",
  "rose",
] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const UpdateName = z.object({ displayName: DisplayName });
export type UpdateName = z.infer<typeof UpdateName>;

export type Me = {
  email: string;
  // Null until the account has chosen one.
  displayName: string | null;
  color: AvatarColor;
  // Events they organize or have answered, newest first.
  events: EventSummary[];
};
