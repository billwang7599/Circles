import type { Member } from "@circles/ai";
import {
  AREAS,
  addDays,
  localDate,
  type BusyPart,
  type Part,
} from "@circles/shared";

const { timezone } = AREAS[0]!;

function busy(days: number, ...parts: Part[]): BusyPart[] {
  const date = addDays(localDate(new Date(), timezone), days);
  return parts.map((part) => ({ date, part }));
}

/** Fresh sample users with new ids, for trying the app without typing data in. */
export function makeSampleUsers(): Member[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "Alex",
      budgetCents: 2000,
      busy: [...busy(1, "morning", "afternoon"), ...busy(2, "evening")],
      preferences: ["ramen"],
    },
    {
      id: crypto.randomUUID(),
      name: "Sam",
      budgetCents: 4000,
      busy: busy(2, "afternoon"),
      preferences: ["korean", "bar"],
    },
    {
      id: crypto.randomUUID(),
      name: "Jordan",
      budgetCents: 3000,
      busy: [],
      preferences: [],
    },
    {
      id: crypto.randomUUID(),
      name: "Riley",
      budgetCents: 1500,
      busy: busy(3, "evening"),
      preferences: ["vegetarian"],
    },
  ];
}
