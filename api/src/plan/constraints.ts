import {
  datesIn,
  Part,
  partInterval,
  partIntervals,
  PREFERENCES,
  subtractIntervals,
  type BusyPart,
  type Interval,
  type PreferenceId,
} from "@circles/shared";

export type Participant = {
  budgetCents: number;
  busy: BusyPart[];
  preferences: PreferenceId[];
};

type Constraints = {
  partySize: number;
  priceCap: number;
  freeWindows: Interval[];
  preferences: { label: string; count: number }[];
  preferenceTypes: string[];
};

const priceLevels: [belowCents: number, level: number][] = [
  [500, 0],
  [1500, 1],
  [3500, 2],
  [7000, 3],
];

function priceLevelFor(budgetCents: number): number {
  return priceLevels.find(([below]) => budgetCents < below)?.[1] ?? 4;
}

export function constraintsFor(
  participants: Participant[],
  plan: {
    windowStart: string;
    windowEnd: string;
    // The parts of each day it can happen in; the whole day when left out.
    parts?: Part[];
    timezone: string;
  },
  now: Date,
): Constraints {
  const nowIso = now.toISOString();
  const parts = plan.parts ?? Part.options;
  const days = datesIn(plan.windowStart, plan.windowEnd)
    .flatMap((date) => partIntervals(date, parts, plan.timezone))
    .filter((day) => day.end > nowIso)
    .map((day) => ({ ...day, start: day.start > nowIso ? day.start : nowIso }));
  const busy = participants.flatMap((p) =>
    p.busy.map((b) => partInterval(b.date, b.part, plan.timezone)),
  );

  const counts = new Map<PreferenceId, number>();
  for (const { preferences } of participants)
    for (const id of new Set(preferences))
      counts.set(id, (counts.get(id) ?? 0) + 1);
  const chosen = PREFERENCES.filter((p) => counts.has(p.id));

  return {
    partySize: participants.length,
    priceCap: priceLevelFor(
      Math.min(...participants.map((p) => p.budgetCents)),
    ),
    freeWindows: subtractIntervals(days, busy),
    preferences: chosen.map((p) => ({
      label: p.label,
      count: counts.get(p.id) ?? 0,
    })),
    preferenceTypes: [...new Set(chosen.flatMap((p) => p.types))],
  };
}
