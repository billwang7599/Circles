import { z } from "zod";
import type { BusyPart } from "./plan.ts";
import { Part } from "./time.ts";

export const BudgetRung = z.enum([
  "under10",
  "under20",
  "under30",
  "under45",
  "under60",
  "none",
]);
export type BudgetRung = z.infer<typeof BudgetRung>;

// No ceiling prefills the most a registration accepts.
export const BUDGET_RUNGS: readonly {
  id: BudgetRung;
  label: string;
  cents: number;
}[] = [
  { id: "under10", label: "Under $10", cents: 1000 },
  { id: "under20", label: "Under $20", cents: 2000 },
  { id: "under30", label: "Under $30", cents: 3000 },
  { id: "under45", label: "Under $45", cents: 4500 },
  { id: "under60", label: "Under $60", cents: 6000 },
  { id: "none", label: "No ceiling", cents: 100000 },
];

export const budgetRung = (id: BudgetRung) =>
  BUDGET_RUNGS.find((rung) => rung.id === id)!;

export const Weekday = z.enum([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]);
export type Weekday = z.infer<typeof Weekday>;

// Plans have no late slot yet, so late answers are kept but never prefill one.
export const AvailabilityPart = z.enum([...Part.options, "late"]);
export type AvailabilityPart = z.infer<typeof AvailabilityPart>;

export const FreeSlot = z.object({ day: Weekday, part: AvailabilityPart });
export type FreeSlot = z.infer<typeof FreeSlot>;

export const Vibe = z.enum([
  "food",
  "coffee",
  "drinks",
  "outdoors",
  "active",
  "chill",
  "culture",
  "games",
  "music",
  "lateNight",
]);
export type Vibe = z.infer<typeof Vibe>;

export const VIBE_LABELS: Record<Vibe, string> = {
  food: "Food",
  coffee: "Coffee",
  drinks: "Drinks",
  outdoors: "Outdoors",
  active: "Active",
  chill: "Chill",
  culture: "Culture",
  games: "Games",
  music: "Music",
  lateNight: "Late night",
};

export const maxVibes = 3;

export const Defaults = z
  .object({
    budget: BudgetRung.nullable(),
    availability: z.array(FreeSlot),
    likes: z.array(Vibe).max(maxVibes, `At most ${maxVibes} likes`),
    dislikes: z.array(Vibe).max(maxVibes, `At most ${maxVibes} dislikes`),
  })
  .refine((d) => !d.likes.some((vibe) => d.dislikes.includes(vibe)), {
    message: "Pick a tag as a like or a dislike, not both",
    path: ["dislikes"],
  });
export type Defaults = z.infer<typeof Defaults>;

export const NO_DEFAULTS: Defaults = {
  budget: null,
  availability: [],
  likes: [],
  dislikes: [],
};

const weekdaysByUtcDay: readonly Weekday[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

const weekdayOf = (date: string): Weekday =>
  weekdaysByUtcDay[new Date(`${date}T00:00:00Z`).getUTCDay()]!;

// The times in a plan a member's week says they can't make. Someone who never
// filled the week in is treated as free, not as busy all the time.
export function defaultBusy(
  dates: string[],
  parts: Part[],
  availability: FreeSlot[],
): BusyPart[] {
  if (availability.length === 0) return [];
  return dates.flatMap((date) =>
    parts
      .filter(
        (part) =>
          !availability.some(
            (slot) => slot.day === weekdayOf(date) && slot.part === part,
          ),
      )
      .map((part) => ({ date, part })),
  );
}

const partNames: Record<AvailabilityPart, [one: string, many: string]> = {
  morning: ["morning", "mornings"],
  afternoon: ["afternoon", "afternoons"],
  evening: ["evening", "evenings"],
  late: ["late night", "late nights"],
};

const dayNames: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function listed(items: string[]) {
  const last = items[items.length - 1] ?? "";
  return items.length < 2
    ? last
    : `${items.slice(0, -1).join(", ")} and ${last}`;
}

// "Weekday evenings, weekend afternoons and evenings". Days that differ from
// the rest of their group are named one by one: "Mon evening, Sat morning".
export function describeAvailability(availability: FreeSlot[]): string {
  const partsOn = (day: Weekday) =>
    AvailabilityPart.options.filter((part) =>
      availability.some((slot) => slot.day === day && slot.part === part),
    );
  const together = (days: readonly Weekday[]) => {
    const first = partsOn(days[0]!);
    return first.length > 0 &&
      days.every((day) => partsOn(day).join() === first.join())
      ? listed(first.map((part) => partNames[part][1]))
      : null;
  };
  const describeGroup = (label: string, days: readonly Weekday[]) => {
    const shared = together(days);
    if (shared) return [`${label} ${shared}`];
    return days.flatMap((day) => {
      const parts = partsOn(day);
      return parts.length > 0
        ? [
            `${dayNames[day]} ${listed(parts.map((part) => partNames[part][0]))}`,
          ]
        : [];
    });
  };
  const everyDay = together(Weekday.options);
  const phrases = everyDay
    ? [`every day: ${everyDay}`]
    : [
        ...describeGroup("weekday", ["mon", "tue", "wed", "thu", "fri"]),
        ...describeGroup("weekend", ["sat", "sun"]),
      ];
  const text = phrases.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
