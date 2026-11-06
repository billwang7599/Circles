import { describe, expect, test } from "vitest";
import {
  budgetRung,
  Defaults,
  defaultBusy,
  describeAvailability,
  NO_DEFAULTS,
  Weekday,
  type AvailabilityPart,
  type FreeSlot,
} from "./defaults.ts";

const slots = (days: Weekday[], ...parts: AvailabilityPart[]): FreeSlot[] =>
  days.flatMap((day) => parts.map((part) => ({ day, part })));

const weekdays: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];
const weekend: Weekday[] = ["sat", "sun"];

describe("describeAvailability", () => {
  test.each<[string, FreeSlot[], string]>([
    ["nothing", [], ""],
    [
      "both groups",
      [
        ...slots(weekdays, "evening"),
        ...slots(weekend, "afternoon", "evening"),
      ],
      "Weekday evenings, weekend afternoons and evenings",
    ],
    ["only weekends", slots(weekend, "morning"), "Weekend mornings"],
    ["every day", slots(Weekday.options, "evening"), "Every day: evenings"],
    [
      "days that differ",
      [...slots(["mon"], "evening"), ...slots(["sat"], "morning", "late")],
      "Mon evening, Sat morning and late night",
    ],
    [
      "three parts",
      slots(weekend, "morning", "afternoon", "evening"),
      "Weekend mornings, afternoons and evenings",
    ],
  ])("%s", (_, availability, text) => {
    expect(describeAvailability(availability)).toBe(text);
  });
});

describe("defaultBusy", () => {
  // 2026-09-26 is a Saturday, 2026-09-28 a Monday.
  const dates = ["2026-09-26", "2026-09-28"];

  test("marks what the week leaves out, in the plan's times", () => {
    expect(
      defaultBusy(
        dates,
        ["afternoon", "evening"],
        [
          ...slots(["sat"], "afternoon", "evening"),
          ...slots(["mon"], "evening"),
        ],
      ),
    ).toEqual([{ date: "2026-09-28", part: "afternoon" }]);
  });

  test("an unfilled week is free, not busy", () => {
    expect(defaultBusy(dates, ["evening"], [])).toEqual([]);
  });

  test("late answers never make anyone free in a plan's evening", () => {
    expect(
      defaultBusy(["2026-09-26"], ["evening"], slots(["sat"], "late")),
    ).toEqual([{ date: "2026-09-26", part: "evening" }]);
  });
});

describe("Defaults", () => {
  test("accepts three likes", () => {
    expect(
      Defaults.safeParse({
        ...NO_DEFAULTS,
        likes: ["food", "music", "games"],
      }).success,
    ).toBe(true);
  });

  test("refuses a fourth like", () => {
    expect(
      Defaults.safeParse({
        ...NO_DEFAULTS,
        likes: ["food", "music", "games", "chill"],
      }).success,
    ).toBe(false);
  });

  test("refuses a tag in both lists", () => {
    expect(
      Defaults.safeParse({
        ...NO_DEFAULTS,
        likes: ["food"],
        dislikes: ["food"],
      }).success,
    ).toBe(false);
  });
});

test("no ceiling prefills the most a registration accepts", () => {
  expect(budgetRung("none").cents).toBe(100000);
  expect(budgetRung("under45").cents).toBe(4500);
});
