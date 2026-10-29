import { expect, test } from "vitest";
import { constraintsFor, type Participant } from "./constraints.ts";
import { slotsIn } from "./slots.ts";

const timezone = "America/Toronto";
const plan = { windowStart: "2026-11-06", windowEnd: "2026-11-07", timezone };
const nicky: Participant = {
  budgetCents: 2500,
  busy: [{ date: "2026-11-06", part: "evening" }],
  preferences: ["ramen"],
};
const bill: Participant = {
  budgetCents: 4000,
  busy: [
    { date: "2026-11-07", part: "morning" },
    { date: "2026-11-07", part: "afternoon" },
  ],
  preferences: ["ramen", "bar", "bar"],
};
const at = (now: string) => constraintsFor([nicky, bill], plan, new Date(now));

test("free windows are the plan days minus every busy part; the cap is the lowest budget", () => {
  const constraints = at("2026-11-06T13:00:00.000Z");
  expect(constraints.freeWindows).toEqual([
    { start: "2026-11-06T13:00:00.000Z", end: "2026-11-06T22:00:00.000Z" },
    { start: "2026-11-07T22:00:00.000Z", end: "2026-11-08T04:00:00.000Z" },
  ]);
  expect(constraints.partySize).toBe(2);
  expect(constraints.priceCap).toBe(2);
  expect(constraints.preferences).toEqual([
    { label: "Ramen", count: 2 },
    { label: "Bar", count: 1 },
  ]);
});

test.each([
  {
    now: "2026-11-06T13:00:00.000Z",
    count: 24,
    first: "2026-11-06T13:00:00.000Z",
    last: "2026-11-08T02:00:00.000Z",
  },
  {
    now: "2026-11-06T19:20:00.000Z",
    count: 11,
    first: "2026-11-06T19:30:00.000Z",
    last: "2026-11-08T02:00:00.000Z",
  },
])(
  "slots from $now are two hours every half hour, local 8:00 to 21:00, with the past removed",
  ({ now, count, first, last }) => {
    const slots = slotsIn(at(now).freeWindows, timezone);
    expect(slots).toHaveLength(count);
    expect(slots[0].start).toBe(first);
    expect(slots.at(-1)?.start).toBe(last);
    expect(
      slots.every((s) => Date.parse(s.end) - Date.parse(s.start) === 7_200_000),
    ).toBe(true);
  },
);

test("no free window with room for a slot yields none", () => {
  const george: Participant = {
    budgetCents: 3000,
    busy: [
      { date: "2026-11-06", part: "morning" },
      { date: "2026-11-06", part: "afternoon" },
      { date: "2026-11-07", part: "evening" },
    ],
    preferences: [],
  };
  const { freeWindows } = constraintsFor(
    [nicky, bill, george],
    plan,
    new Date("2026-11-06T13:00:00.000Z"),
  );
  expect(freeWindows).toEqual([]);
  expect(slotsIn(freeWindows, timezone)).toEqual([]);
});
