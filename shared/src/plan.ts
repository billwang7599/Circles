import { z } from "zod";
import { AreaId } from "./areas.ts";
import type { MemberSummary } from "./circle.ts";
import { PreferenceId } from "./preferences.ts";
import { Part, When, type Interval } from "./time.ts";

export const CreatePlan = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a title")
    .max(80, "At most 80 characters"),
  areaId: AreaId,
  when: When,
});
export type CreatePlan = z.infer<typeof CreatePlan>;

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

export type PlanStatus = "open" | "locked";

export type PlanSummary = {
  id: string;
  title: string;
  status: PlanStatus;
  windowStart: string;
  windowEnd: string;
  lockedStart: string | null;
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
    area: { id: AreaId; name: string };
    windowStart: string;
    windowEnd: string;
    status: PlanStatus;
    version: number;
    initiator: MemberSummary;
    locked?: { optionId: string; start: string };
  };
  members: {
    id: string;
    name: string;
    registered: boolean;
    attending: boolean;
    voteOptionId: string | null;
  }[];
  me: {
    registration?: RegistrationInput;
    defaults: { budgetCents?: number; preferences: PreferenceId[] };
  };
  options: OptionView[];
  optionsStale: boolean;
};
