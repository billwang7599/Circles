import { PlanRequestSchema, type PlanRequest } from "@circles/shared";
import { describe, expect, test } from "vitest";
import {
  applyPatch,
  changePlan,
  editsToPatch,
  effectiveBudget,
} from "./chat.ts";
import { createFakeLlmModel } from "./fakes.ts";
import { LlmClient } from "./llm.ts";
import { PlannerError } from "./validated.ts";

const toronto = {
  name: "Toronto",
  lat: 43.6532,
  lng: -79.3832,
  timezone: "America/Toronto",
};
const request: PlanRequest = PlanRequestSchema.parse({
  text: "buffet",
  group: {
    members: [
      { id: "a", name: "A", location: toronto, budget: 20, unavailable: [] },
      { id: "b", name: "B", location: toronto, budget: 40, unavailable: [] },
    ],
  },
  location: toronto,
  radiusKm: 15,
});
const llm = (interpret?: (prompt: string) => unknown) =>
  new LlmClient(createFakeLlmModel(interpret ? { interpret } : {}));

describe("applyPatch", () => {
  test("replaces the search text and says what changed", () => {
    const r = applyPatch(request, { query: "hotpot" });
    expect(r.request.text).toBe("hotpot");
    expect(r.changes).toEqual(['Searching for "hotpot" instead of "buffet"']);
  });

  test("an empty patch changes nothing", () => {
    const r = applyPatch(request, {});
    expect(r.changes).toEqual([]);
    expect(r.request).toEqual(request);
  });

  test("null fields and values that equal the current ones are ignored", () => {
    const r = applyPatch(request, {
      query: "buffet",
      budgetPerPerson: undefined,
      radiusKm: 15,
      cityId: "toronto",
      when: undefined,
      filterModes: { budget: "hard" },
    });
    expect(r.changes).toEqual([]);
  });

  test("sets the days and the parts of the day", () => {
    const r = applyPatch(request, {
      when: { days: ["sunday"], partsOfDay: ["evening"] },
    });
    expect(r.request.when).toEqual({
      days: ["sunday"],
      partsOfDay: ["evening"],
    });
    expect(r.changes).toEqual(["When: Sunday, evening"]);
  });

  test("changing only the days keeps the parts of the day", () => {
    const base = applyPatch(request, {
      when: { days: ["sunday"], partsOfDay: ["evening"] },
    }).request;
    const r = applyPatch(base, { when: { days: ["saturday"] } });
    expect(r.request.when).toEqual({
      days: ["saturday"],
      partsOfDay: ["evening"],
    });
  });

  test("only an explicit clearWhen removes the limit", () => {
    const base = applyPatch(request, { when: { days: ["sunday"] } }).request;
    const r = applyPatch(base, { clearWhen: true });
    expect(r.request.when).toBeUndefined();
    expect(r.changes).toEqual(["When: any time"]);
  });

  test("empty lists from a model do not clear an existing limit", () => {
    const base = applyPatch(request, { when: { days: ["sunday"] } }).request;
    const r = applyPatch(base, { when: { days: [], partsOfDay: [] } });
    expect(r.request.when).toEqual({ days: ["sunday"], partsOfDay: [] });
    expect(r.changes).toEqual([]);
  });

  test("a day asked for wins over a stray clearWhen", () => {
    const r = applyPatch(request, {
      clearWhen: true,
      when: { days: ["tomorrow"] },
    });
    expect(r.request.when?.days).toEqual(["tomorrow"]);
  });

  test("the budget override replaces the lowest member budget", () => {
    expect(effectiveBudget(request)).toBe(20);
    const r = applyPatch(request, { budgetPerPerson: 35 });
    expect(r.request.budgetPerPerson).toBe(35);
    expect(effectiveBudget(r.request)).toBe(35);
    expect(r.changes).toEqual(["Budget: $35 per person, was $20"]);
  });

  test("radius, location and filter modes", () => {
    const r = applyPatch(request, {
      radiusKm: 25,
      cityId: "vancouver",
      filterModes: { budget: "prefer", area: "hard" },
    });
    expect(r.request.radiusKm).toBe(25);
    expect(r.request.location.name).toBe("Vancouver");
    expect(r.request.filterModes.budget).toBe("prefer");
    expect(r.request.filterModes.area).toBe("hard");
    expect(r.changes).toEqual([
      "Radius: 25 km, was 15 km",
      "Location: Vancouver, was Toronto",
      "Budget is now a preference",
      "Location is now a must-have",
    ]);
  });

  test("an unknown city is ignored, not invented", () => {
    const r = applyPatch(request, { cityId: "atlantis" });
    expect(r.changes).toEqual([]);
    expect(r.request.location.name).toBe("Toronto");
  });

  test("does not modify the plan it was given", () => {
    const before = structuredClone(request);
    applyPatch(request, { query: "x", budgetPerPerson: 99, radiusKm: 5 });
    expect(request).toEqual(before);
  });

  test("an out-of-range value fails instead of producing a bad plan", () => {
    expect(() => applyPatch(request, { budgetPerPerson: -5 })).toThrow();
  });
});

describe("changePlan with the fake model", () => {
  test("hotpot instead of buffet, on Sunday, with a bigger budget", async () => {
    const r = await changePlan(
      request,
      "change to find hotpot instead of buffet, and find it on sunday with an increased budget",
      llm(),
    );
    expect(r.request.text).toBe("hotpot");
    expect(r.request.when?.days).toEqual(["sunday"]);
    expect(r.request.budgetPerPerson).toBe(30); // 20 * 1.5
    expect(r.changes).toHaveLength(3);
  });

  test("refine the search: specifically seafood buffet", async () => {
    const r = await changePlan(
      request,
      "i want to look for specifically seafood buffet",
      llm(),
    );
    expect(r.request.text).toBe("seafood buffet");
    expect(r.changes).toEqual([
      'Searching for "seafood buffet" instead of "buffet"',
    ]);
  });

  test("a named amount, a radius and a city", async () => {
    const r = await changePlan(
      request,
      "find it in Vancouver, within 30 km, budget of 45",
      llm(),
    );
    expect(r.request.budgetPerPerson).toBe(45);
    expect(r.request.radiusKm).toBe(30);
    expect(r.request.location.name).toBe("Vancouver");
  });

  test("making a filter a preference", async () => {
    const r = await changePlan(request, "make the budget a preference", llm());
    expect(r.request.filterModes.budget).toBe("prefer");
  });

  test("a message that asks for nothing changes nothing", async () => {
    const r = await changePlan(request, "thanks, looks good", llm());
    expect(r.changes).toEqual([]);
  });

  test("the model's answer is validated: bad output is retried, then fails", async () => {
    let calls = 0;
    const ok = await changePlan(
      request,
      "anything",
      llm(() => {
        calls++;
        return calls === 1
          ? { edits: [{ field: "radiusKm", value: "9999" }] }
          : { edits: [{ field: "query", value: "ramen" }] };
      }),
    );
    expect(calls).toBe(2);
    expect(ok.request.text).toBe("ramen");
    await expect(
      changePlan(
        request,
        "anything",
        llm(() => ({ budgetPerPerson: "lots" })),
      ),
    ).rejects.toBeInstanceOf(PlannerError);
  });

  test("an empty list of edits means no change", async () => {
    const r = await changePlan(
      request,
      "anything",
      llm(() => ({ edits: [] })),
    );
    expect(r.changes).toEqual([]);
  });
});

describe("editsToPatch", () => {
  const e = (field: string, value: string) => ({ field, value }) as never;

  test("turns a list of edits into a patch", () => {
    const patch = editsToPatch({
      edits: [
        e("query", "hotpot"),
        e("days", "Sunday"),
        e("partsOfDay", "evening"),
        e("budgetPerPerson", "$30"),
        e("radiusKm", "25"),
        e("cityId", "Vancouver"),
        e("budgetMode", "prefer"),
        e("areaMode", "hard"),
      ],
    });
    expect(patch).toEqual({
      query: "hotpot",
      when: { days: ["sunday"], partsOfDay: ["evening"] },
      budgetPerPerson: 30,
      radiusKm: 25,
      cityId: "vancouver",
      filterModes: { budget: "prefer", area: "hard" },
    });
  });

  test("several days become one list", () => {
    expect(
      editsToPatch({ edits: [e("days", "saturday"), e("days", "sunday")] }).when
        ?.days,
    ).toEqual(["saturday", "sunday"]);
  });

  test("anything that is not a known value throws instead of being guessed", () => {
    for (const bad of [
      e("days", "someday"),
      e("partsOfDay", "midnight"),
      e("budgetPerPerson", "lots"),
      e("budgetPerPerson", "-5"),
      e("radiusKm", "0"),
      e("radiusKm", "500"),
      e("areaMode", "maybe"),
      { field: "colour", value: "red" } as never,
    ]) {
      expect(() => editsToPatch({ edits: [bad] })).toThrow();
    }
  });

  test("blank text and a non-true clearWhen are ignored", () => {
    expect(
      editsToPatch({ edits: [e("query", "  "), e("clearWhen", "false")] }),
    ).toEqual({});
  });
});
