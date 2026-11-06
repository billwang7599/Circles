import { z } from "zod";
import type { PlanSummary } from "./plan.ts";

export const DisplayName = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(40, "At most 40 characters");

const JoinCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[2-9A-HJ-NP-Z]{6}$/, "Enter the 6-character code");

export const Email = z.email("Enter an email address");

export const AVATAR_COLORS = [
  "violet",
  "blue",
  "fern",
  "ember",
  "rose",
] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const CIRCLE_EMOJI = [
  "🎉",
  "🍜",
  "🏠",
  "🎓",
  "⚽",
  "🎮",
  "🎵",
  "🎨",
  "☕",
  "🏕️",
  "✈️",
  "📚",
] as const;
export const CircleEmoji = z.enum(CIRCLE_EMOJI);
export type CircleEmoji = z.infer<typeof CircleEmoji>;

export const CreateCircle = z.object({
  name: DisplayName,
  emoji: CircleEmoji.optional(),
});
export type CreateCircle = z.infer<typeof CreateCircle>;

export const JoinCircle = z.object({ code: JoinCode });
export type JoinCircle = z.infer<typeof JoinCircle>;

export const UpdateName = z.object({ displayName: DisplayName });
export type UpdateName = z.infer<typeof UpdateName>;

export type CircleSummary = {
  id: string;
  name: string;
  joinCode: string;
  emoji: CircleEmoji | null;
};
export type MemberSummary = { id: string; name: string };

export type MembershipResponse = {
  circle: CircleSummary;
  member: MemberSummary;
};

export type NextPlan = {
  id: string;
  title: string;
  kind: "inputs" | "vote" | "locked" | "open";
};

export type Me = {
  email: string;
  // Null until the account has chosen one.
  displayName: string | null;
  color: AvatarColor;
  circles: {
    id: string;
    name: string;
    emoji: CircleEmoji | null;
    memberId: string;
    memberName: string;
    next: NextPlan | null;
  }[];
};

export type CircleView = {
  circle: CircleSummary;
  me: MemberSummary;
  members: { id: string; name: string; color: AvatarColor; joinedAt: string }[];
  plans: PlanSummary[];
};
