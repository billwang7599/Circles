import { z } from "zod";
import { AreaId } from "./areas.ts";
import type { AvatarColor, MemberSummary } from "./circle.ts";
import { PreferenceId } from "./preferences.ts";
import { daysBetween, maxWindowDays, Part, type Interval } from "./time.ts";

// Window dates are in the area's time zone, both included.
export const CreatePlan = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Enter a title")
      .max(80, "At most 80 characters"),
    areaId: AreaId,
    windowStart: z.iso.date(),
    windowEnd: z.iso.date(),
    parts: z.array(Part).min(1, "Pick a time of day"),
  })
  .refine((p) => p.windowEnd >= p.windowStart, {
    message: "The end can't be before the start",
    path: ["windowEnd"],
  })
  .refine((p) => daysBetween(p.windowStart, p.windowEnd) <= maxWindowDays, {
    message: `At most ${maxWindowDays + 1} days`,
    path: ["windowEnd"],
  })
  // Stored in the day's order, without repeats.
  .transform((p) => ({
    ...p,
    parts: Part.options.filter((part) => p.parts.includes(part)),
  }));
export type CreatePlan = z.infer<typeof CreatePlan>;

export const EditPlan = CreatePlan;
export type EditPlan = CreatePlan;

export const BusyPart = z.object({ date: z.iso.date(), part: Part });
export type BusyPart = z.infer<typeof BusyPart>;

export const RegistrationInput = z
  .object({
    attending: z.boolean(),
    budgetCents: z
      .int()
      .min(100, "At least $1")
      .max(100000, "At most $1,000")
      .optional(),
    busy: z.array(BusyPart),
    preferences: z.array(PreferenceId),
  })
  .refine((r) => !r.attending || r.budgetCents !== undefined, {
    message: "Enter a budget",
    path: ["budgetCents"],
  });
export type RegistrationInput = z.infer<typeof RegistrationInput>;

// The same answers in any order: saving them again must not disturb the plan.
export function sameRegistration(
  a: RegistrationInput,
  b: RegistrationInput | undefined,
): boolean {
  if (!b) return false;
  const sorted = (items: string[]) => [...items].sort().join(",");
  const busy = (r: RegistrationInput) =>
    sorted(r.busy.map((part) => `${part.date} ${part.part}`));
  return (
    a.attending === b.attending &&
    (a.budgetCents ?? null) === (b.budgetCents ?? null) &&
    busy(a) === busy(b) &&
    sorted(a.preferences) === sorted(b.preferences)
  );
}

export const Vote = z.object({ optionId: z.uuid() });
export type Vote = z.infer<typeof Vote>;

export const Lock = z.object({ optionId: z.uuid(), start: z.iso.datetime() });
export type Lock = z.infer<typeof Lock>;

export type PlanStatus = "open" | "locked";

// Where a plan is in its life. Options only matter while it is open: fresh
// ones can be voted on and locked in, stale ones need a refresh first.
export type PlanPhase =
  | { kind: "open"; options: "none" | "fresh" | "stale" }
  | { kind: "ended" }
  | { kind: "locked" }
  | { kind: "past" };

export type PlanSummary = {
  id: string;
  title: string;
  areaId: AreaId;
  windowStart: string;
  windowEnd: string;
  lockedStart: string | null;
  phase: PlanPhase;
  registered: boolean;
  attending: boolean;
  voted: boolean;
};

export type Place = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  types: string[];
  distanceKm: number;
  mapsUrl: string;
};

export type OptionView = {
  id: string;
  rank: number;
  place: Place;
  times: Interval[];
  summary: string;
  unverified: ("budget" | "openHours")[];
  votes: number;
};

export type PlanView = {
  plan: {
    id: string;
    title: string;
    circle: { id: string; name: string };
    area: { id: AreaId; name: string };
    windowStart: string;
    windowEnd: string;
    // The parts of each day the plan can happen in.
    parts: Part[];
    phase: PlanPhase;
    initiator: MemberSummary;
    locked?: { optionId: string; start: string };
  };
  members: {
    id: string;
    name: string;
    color: AvatarColor;
    registered: boolean;
    attending: boolean;
    voteOptionId: string | null;
  }[];
  me: {
    id: string;
    registration?: RegistrationInput;
    defaults: { budgetCents?: number; preferences: PreferenceId[] };
  };
  options: OptionView[];
};
