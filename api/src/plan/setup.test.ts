import { Questions, type CreateEvent } from "@circles/shared";
import { expect, test } from "vitest";
import { scriptedModel, skiTrip } from "../testModel.ts";
import {
  checkSetup,
  fakeSetup,
  setupEvent,
  titleFrom,
  type SetupModel,
} from "./setup.ts";

const input = (description: string): CreateEvent => ({
  description,
  windowStart: "2026-12-01",
  windowEnd: "2027-01-31",
});

const flat = {
  kind: "text",
  title: "Anything else?",
  hint: "",
  presets: null,
  choices: null,
};

test("the fake asks a ski trip about dates, budget and resorts, and a plain plan the plain set", async () => {
  const ski = await setupEvent(fakeSetup(), input(skiTrip));
  expect(ski.title).toBe("Ski trip");
  expect(ski.questions.map((q) => q.kind)).toEqual([
    "dates",
    "budget",
    "choice",
    "text",
  ]);
  const resort = ski.questions.find((q) => q.kind === "choice")!;
  expect(resort.choices.map((c) => c.label)).toEqual([
    "Blue Mountain",
    "Mont Tremblant",
    "Banff Sunshine",
    "Whistler Blackcomb",
  ]);
  expect(resort.choices.every((c) => c.detail.length > 0)).toBe(true);
  expect(Questions.safeParse(ski.questions).success).toBe(true);

  const again = await setupEvent(fakeSetup(), input(skiTrip));
  expect(again.questions.map((q) => q.title)).toEqual(
    ski.questions.map((q) => q.title),
  );

  const plain = await setupEvent(fakeSetup(), input("Dinner for my birthday"));
  expect(plain.title).toBe("Dinner for my birthday");
  expect(plain.questions.map((q) => q.kind)).toEqual([
    "dates",
    "budget",
    "text",
  ]);
  const cottage = await setupEvent(
    fakeSetup(),
    input("Cottage weekend up north"),
  );
  expect(cottage.questions.find((q) => q.kind === "choice")?.title).toBe(
    "Which area?",
  );
});

test("a bad answer is told what was wrong and asked again; ids come from code", async () => {
  const dates = { ...flat, kind: "dates", title: "Which days?" };
  const scripted = scriptedModel<CreateEvent>([
    "garbage",
    { title: "Ski trip", questions: [dates, { ...dates, title: "Again?" }] },
    {
      title: "Ski trip",
      questions: [
        dates,
        {
          ...flat,
          kind: "budget",
          title: "Your budget",
          presets: [300, 600, 1000],
        },
        {
          ...flat,
          kind: "choice",
          title: "Ski resort",
          choices: [
            { label: "Blue Mountain", detail: "Collingwood, ON" },
            { label: "Mont Tremblant", detail: "Laurentians, QC" },
          ],
        },
        flat,
      ],
    },
  ]);
  const { title, questions } = await setupEvent(scripted.model, input(skiTrip));
  expect(scripted.rejections).toEqual([
    [],
    [expect.stringMatching(/must be an object with a title/)],
    [
      expect.stringMatching(/must be an object with a title/),
      expect.stringMatching(/Only one dates question and one budget question/),
    ],
  ]);
  expect(title).toBe("Ski trip");
  expect(questions.map((q) => q.kind)).toEqual([
    "dates",
    "budget",
    "choice",
    "text",
  ]);
  expect(questions.every((q) => /^[a-z0-9]{1,16}$/.test(q.id))).toBe(true);
  const resort = questions.find((q) => q.kind === "choice")!;
  expect(resort.choices.map((c) => c.id)).toEqual([
    expect.stringMatching(/^[a-z0-9]{1,16}$/),
    expect.stringMatching(/^[a-z0-9]{1,16}$/),
  ]);
  expect(Questions.safeParse(questions).success).toBe(true);
});

test("the checks name the limit that was crossed", () => {
  const problem = (output: unknown) => {
    const checked = checkSetup(output);
    return "problem" in checked ? checked.problem : null;
  };
  expect(problem({ title: "x".repeat(61), questions: [flat] })).toMatch(
    /^title: At most 60 characters/,
  );
  expect(problem({ title: "Ok", questions: [] })).toBe(
    "ask at least one question",
  );
  expect(
    problem({
      title: "Ok",
      questions: [{ ...flat, kind: "budget", presets: [600, 300] }],
    }),
  ).toMatch(/Amounts must go up/);
  expect(
    problem({
      title: "Ok",
      questions: [
        { ...flat, kind: "choice", choices: [{ label: "One", detail: "" }] },
      ],
    }),
  ).toMatch(/Add at least two options/);
  expect(
    problem({
      title: "Ok",
      questions: Array.from({ length: 9 }, () => flat),
    }),
  ).toMatch(/At most 8 questions/);
  expect(problem({ title: "Ok", questions: [flat] })).toBeNull();
});

test("three unusable answers, or a model that can't be reached, fall back to code", async () => {
  const garbage = scriptedModel<CreateEvent>([null, null, null]);
  const long = `${"Ski trip with everyone from the office".padEnd(70, " again")} and more`;
  const fallen = await setupEvent(garbage.model, input(long));
  expect(garbage.rejections).toHaveLength(3);
  expect(fallen.title).toBe(titleFrom(long));
  expect(fallen.questions.map((q) => [q.kind, q.title])).toEqual([
    ["dates", "Available dates"],
    ["budget", "Your budget"],
    ["text", "Anything else?"],
  ]);
  const budget = fallen.questions.find((q) => q.kind === "budget")!;
  expect(budget.presets).toEqual([300, 600, 1000]);
  expect(Questions.safeParse(fallen.questions).success).toBe(true);

  const down: SetupModel = {
    model: "down",
    fn: () => Promise.reject(new Error("timed out")),
  };
  const unreachable = await setupEvent(down, input(skiTrip));
  expect(unreachable.title).toBe("Ski trip with Ben and Chloe");
  expect(unreachable.questions).toHaveLength(3);
});

test("a question about food is dropped unless the plan is about food", async () => {
  const dates = { ...flat, kind: "dates", title: "Which days?" };
  const diet = { ...flat, title: "Any dietary restrictions?" };
  const asked = (description: string, questions: unknown[]) =>
    setupEvent(
      scriptedModel<CreateEvent>([{ title: "Plan", questions }]).model,
      input(description),
    );
  const ski = await asked(skiTrip, [dates, diet, flat]);
  expect(ski.questions.map((q) => q.title)).toEqual([
    "Which days?",
    "Anything else?",
  ]);
  const dinner = await asked("Dinner for my birthday", [dates, diet, flat]);
  expect(dinner.questions.map((q) => q.title)).toEqual([
    "Which days?",
    "Any dietary restrictions?",
    "Anything else?",
  ]);
  for (const title of [
    "What should we eat?",
    "Lunch spot",
    "Food allergies",
    "Vegan or vegetarian?",
    "Favourite cuisine",
  ]) {
    const { questions } = await asked(skiTrip, [dates, { ...flat, title }]);
    expect(questions.map((q) => q.title)).toEqual(["Which days?"]);
  }
  const kept = await asked(skiTrip, [dates, { ...flat, title: "Ski resort" }]);
  expect(kept.questions).toHaveLength(2);
  // Nothing left to ask: the plain set stands under the model's title.
  const only = await asked(skiTrip, [diet]);
  expect(only.title).toBe("Plan");
  expect(only.questions.map((q) => q.kind)).toEqual([
    "dates",
    "budget",
    "text",
  ]);
});

test("a title cut from the description keeps whole words and whole characters", () => {
  expect(titleFrom(skiTrip)).toBe("Ski trip with Ben and Chloe");
  // A clause under three characters is no title: the whole text stands.
  expect(titleFrom("Go. Now")).toBe("Go. Now");
  expect(
    titleFrom(
      "Cottage weekend at the lake with friends and family, then dinner downtown",
    ),
  ).toBe("Cottage weekend at the lake with friends and family");
  expect(
    titleFrom(
      "Cottage weekend at the lake with friends and family and the neighbours too",
    ),
  ).toBe("Cottage weekend at the lake with friends and family and the");
  expect(titleFrom("x".repeat(70))).toBe("x".repeat(60));
  expect(titleFrom("🎉".repeat(61))).toBe("🎉".repeat(60));
  expect(titleFrom(`${"a".repeat(59)} b`)).toBe("a".repeat(59));
});
