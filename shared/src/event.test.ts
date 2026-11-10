import { expect, test } from "vitest";
import {
  answerLines,
  budgetRanges,
  CreateEvent,
  Questions,
  type Question,
} from "./event.ts";

const dates: Question = { kind: "dates", id: "d", title: "Dates", hint: "" };
const budget: Question = {
  kind: "budget",
  id: "b",
  title: "Budget",
  hint: "",
  presets: [300, 600, 1000],
};
const resort: Question = {
  kind: "choice",
  id: "r",
  title: "Ski resort",
  hint: "",
  choices: [
    { id: "blue", label: "Blue Mountain", detail: "Collingwood, ON" },
    { id: "banff", label: "Banff Sunshine", detail: "" },
  ],
};
const note: Question = {
  kind: "text",
  id: "n",
  title: "Anything else?",
  hint: "",
};

test("a budget question offers a range up to each amount and one above", () => {
  expect(budgetRanges([300, 600, 1000])).toEqual([
    { label: "Under $300", max: 300 },
    { label: "$300 – $600", max: 600 },
    { label: "$600 – $1,000", max: 1000 },
    { label: "$1,000+", max: null },
  ]);
  expect(budgetRanges([50])).toEqual([
    { label: "Under $50", max: 50 },
    { label: "$50+", max: null },
  ]);
});

test("questions allow one calendar, one budget, rising amounts and distinct ids", () => {
  const issue = (questions: unknown) => {
    const result = Questions.safeParse(questions);
    return result.success ? null : result.error.issues[0]!.message;
  };
  expect(issue([dates, budget, resort, note])).toBeNull();
  expect(issue([])).toBeNull();
  expect(issue([dates, { ...dates, id: "d2" }])).toBe(
    "Only one dates question and one budget question",
  );
  expect(issue([note, { ...resort, id: "n" }])).toBe("Questions repeat");
  expect(issue([{ ...budget, presets: [600, 300] }])).toBe(
    "Amounts must go up",
  );
  expect(issue([{ ...budget, presets: [0, 300] }])).toBe("At least $1");
  expect(issue([{ ...budget, presets: [300, 200_000] }])).toBe(
    "At most $100,000",
  );
  expect(issue([{ ...budget, presets: [299.5] }])).toBe("Enter whole amounts");
  expect(issue([{ ...resort, choices: resort.choices.slice(0, 1) }])).toBe(
    "Add at least two options",
  );
});

test("an event's window is at most 90 days and does not end before it starts", () => {
  const issue = (windowStart: string, windowEnd: string) => {
    const result = CreateEvent.safeParse({
      description: "Ski trip",
      windowStart,
      windowEnd,
    });
    return result.success ? null : result.error.issues[0]!.message;
  };
  expect(issue("2026-12-01", "2027-02-28")).toBeNull();
  expect(issue("2026-12-01", "2027-03-01")).toBe("At most 90 days");
  expect(issue("2026-12-02", "2026-12-01")).toBe(
    "The end can't be before the start",
  );
});

test("answers read as lines without the budget or answers to changed questions", () => {
  expect(
    answerLines([dates, budget, resort, note], {
      d: {
        kind: "dates",
        ranges: [
          { start: "2026-12-11", end: "2026-12-14" },
          { start: "2026-12-27", end: "2027-01-02" },
        ],
      },
      b: { kind: "budget", max: 600 },
      r: { kind: "choice", choices: ["banff", "gone", "blue"] },
      n: { kind: "text", text: "" },
      old: { kind: "text", text: "From a removed question" },
    }),
  ).toEqual([
    { title: "Dates", text: "Dec 11 – 14, Dec 27 – Jan 2" },
    { title: "Ski resort", text: "Blue Mountain, Banff Sunshine" },
  ]);
  expect(
    answerLines([{ ...note, id: "r" }], {
      r: { kind: "choice", choices: ["blue"] },
    }),
  ).toEqual([]);
});
