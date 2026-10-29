import { z } from "zod";
import type { PlanSummary } from "./plan.ts";

const Name = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(40, "At most 40 characters");

const JoinCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[2-9A-HJ-NP-Z]{6}$/, "Enter the 6-character code");

export const AVATAR_COLORS = [
  "violet",
  "blue",
  "fern",
  "ember",
  "rose",
] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

export const CreateCircle = z.object({ name: Name, memberName: Name });
export type CreateCircle = z.infer<typeof CreateCircle>;

export const JoinCircle = z.object({ code: JoinCode, name: Name });
export type JoinCircle = z.infer<typeof JoinCircle>;

export type CircleSummary = { id: string; name: string; joinCode: string };
export type MemberSummary = { id: string; name: string };

export type MembershipResponse = {
  token?: string;
  circle: CircleSummary;
  member: MemberSummary;
};

export type NextPlan = {
  id: string;
  title: string;
  kind: "inputs" | "vote" | "locked" | "open";
};

export type Me = {
  circles: {
    id: string;
    name: string;
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
