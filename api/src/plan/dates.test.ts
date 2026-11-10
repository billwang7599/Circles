import type { ReadDates } from "@circles/shared";
import { expect, test } from "vitest";
import { scriptedModel } from "../testModel.ts";
import {
  fakeDates,
  readDates,
  resolveDates,
  type DatesModel,
} from "./dates.ts";

// A Monday.
const today = "2026-11-09";
const read = async (text: string) => {
  const dates = await readDates(fakeDates(), { text, today });
  return dates && `${dates.windowStart} ${dates.windowEnd}`;
};

test("the fake reads month names and quick-pick phrases, the same way every time", async () => {
  expect(await read("December or January")).toBe("2026-12-01 2027-01-31");
  expect(await read("Sometime in December")).toBe("2026-12-01 2026-12-31");
  expect(await read("this weekend")).toBe("2026-11-14 2026-11-15");
  expect(await read("Next 2 weeks")).toBe("2026-11-16 2026-11-29");
  expect(await read("next month")).toBe("2026-12-01 2026-12-31");
  expect(await read("next two months")).toBe("2026-12-01 2027-01-31");
  expect(await read("Dec 12-14")).toBe("2026-12-12 2026-12-14");
  expect(await read("Dec 28 to Jan 3")).toBe("2026-12-28 2027-01-03");
  expect(await read("Dec 12th")).toBe("2026-12-12 2026-12-12");
  // The rest of this month, and the next time a passed day comes round.
  expect(await read("November")).toBe("2026-11-09 2026-11-30");
  // Six days ago: this year's, for the route to call out as passed.
  expect(await read("Nov 3")).toBe("2026-11-03 2026-11-03");
  expect(await read("whenever works")).toBeUndefined();
  expect(await read("March through June")).toBeUndefined();
});

type Parts = Parameters<typeof resolveDates>[0];

test("years, whole months and single days are code's to fill in", () => {
  const none: Parts = {
    preset: null,
    startMonth: null,
    startDay: null,
    endMonth: null,
    endDay: null,
  };
  const resolve = (parts: Partial<Parts>) =>
    resolveDates({ ...none, ...parts }, today);
  const window = (windowStart: string, windowEnd: string) => ({
    value: { windowStart, windowEnd },
  });

  // A preset wins over anything else in the answer.
  expect(resolve({ preset: "nextMonth", startMonth: 5 })).toEqual(
    window("2026-12-01", "2026-12-31"),
  );
  expect(resolve({ startMonth: 2 })).toEqual(
    window("2027-02-01", "2027-02-28"),
  );
  expect(resolve({ startMonth: 12, startDay: 12 })).toEqual(
    window("2026-12-12", "2026-12-12"),
  );
  expect(resolve({ startMonth: 12, startDay: 12, endMonth: 1 })).toEqual(
    window("2026-12-12", "2027-01-31"),
  );
  expect(resolve({ startMonth: 11, startDay: 9 })).toEqual(
    window("2026-11-09", "2026-11-09"),
  );
  expect(resolve({ startMonth: 11, endDay: 20 })).toEqual(
    window("2026-11-09", "2026-11-20"),
  );
  // Days that only just went by stay this year's, for the route to refuse;
  // a month further back is next year's.
  expect(resolve({ startMonth: 11, startDay: 2, endDay: 8 })).toEqual(
    window("2026-11-02", "2026-11-08"),
  );
  expect(resolve({ startMonth: 8, startDay: 1 })).toEqual(
    window("2027-08-01", "2027-08-01"),
  );

  const problem = (parts: Partial<Parts>) => {
    const resolved = resolve(parts);
    return "problem" in resolved ? resolved.problem : null;
  };
  expect(problem({})).toMatch(/startMonth/);
  expect(problem({ startMonth: 13 })).toMatch(/1 to 12/);
  expect(problem({ startMonth: 1.5 })).toMatch(/whole numbers/);
  expect(problem({ startMonth: 2, startDay: 30 })).toBe(
    "day 30 is not in month 2",
  );
  expect(problem({ startMonth: 2, endDay: 30 })).toBe(
    "day 30 is not in month 2",
  );
  expect(problem({ startMonth: 1, endMonth: 6 })).toMatch(/at most 90 days/);
});

test("a rejected answer is asked again with the problem; three bad ones read as nothing", async () => {
  const input: ReadDates = { text: "the weekend", today };
  const scripted = scriptedModel<ReadDates>([
    "garbage",
    { preset: null, startMonth: 13, startDay: null, endMonth: null, endDay: 1 },
    {
      preset: "thisWeekend",
      startMonth: null,
      startDay: null,
      endMonth: null,
      endDay: null,
    },
  ]);
  expect(await readDates(scripted.model, input)).toEqual({
    windowStart: "2026-11-14",
    windowEnd: "2026-11-15",
  });
  expect(scripted.inputs[0]).toEqual(input);
  expect(scripted.rejections).toEqual([
    [],
    [expect.stringMatching(/must be an object with preset/)],
    [
      expect.stringMatching(/must be an object with preset/),
      expect.stringMatching(/whole numbers from 1 to 12/),
    ],
  ]);

  const hopeless = scriptedModel<ReadDates>([null, null, null]);
  expect(await readDates(hopeless.model, input)).toBeUndefined();
  expect(hopeless.rejections).toHaveLength(3);
});

test("a model that cannot be reached gives way to the pattern reader", async () => {
  let calls = 0;
  const unreachable: DatesModel = {
    model: "unreachable",
    fn: async () => {
      calls += 1;
      throw new Error("Could not load credentials");
    },
  };
  expect(await readDates(unreachable, { text: "December", today })).toEqual({
    windowStart: "2026-12-01",
    windowEnd: "2026-12-31",
  });
  expect(
    await readDates(unreachable, { text: "whenever works", today }),
  ).toBeUndefined();
  // Not asked again once it is known to be down.
  expect(calls).toBe(2);
});
