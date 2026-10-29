import { areaById } from "@circles/shared";
import { PlanRequestSchema, type PlanRequest } from "./types.ts";
import { describe, expect, test } from "vitest";
import { applyPatch, changePlan, editsToPatch } from "./chat.ts";
import { effectiveBudgetCents } from "./constraints.ts";
import { createFakeLlmModel } from "./devFakes.ts";
import { LlmClient } from "./llm.ts";
import { PlannerError } from "./validated.ts";

const request: PlanRequest = PlanRequestSchema.parse({
  text: "buffet",
  group: {
    members: [
      { id: "a", name: "A", budgetCents: 2000, busy: [], preferences: [] },
      { id: "b", name: "B", budgetCents: 4000, busy: [], preferences: [] },
    ],
  },
  areaId: "uptown",
  windowStart: "2026-10-03",
  windowEnd: "2026-10-09",
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
      budgetCents: undefined,
      radiusKm: 15,
      areaId: "uptown",
      timeFilter: undefined,
      filterModes: { budget: "hard" },
    });
    expect(r.changes).toEqual([]);
  });

  test("sets the days and the parts of the day", () => {
    const r = applyPatch(request, {
      timeFilter: { days: ["sunday"], partsOfDay: ["evening"] },
    });
    expect(r.request.timeFilter).toEqual({
      days: ["sunday"],
      partsOfDay: ["evening"],
    });
    expect(r.changes).toEqual(["When: Sunday, evening"]);
  });

  test("changing only the days keeps the parts of the day", () => {
    const base = applyPatch(request, {
      timeFilter: { days: ["sunday"], partsOfDay: ["evening"] },
    }).request;
    const r = applyPatch(base, { timeFilter: { days: ["saturday"] } });
    expect(r.request.timeFilter).toEqual({
      days: ["saturday"],
      partsOfDay: ["evening"],
    });
  });

  test("only an explicit clear removes the limit", () => {
    const base = applyPatch(request, {
      timeFilter: { days: ["sunday"] },
    }).request;
    const r = applyPatch(base, { clearTimeFilter: true });
    expect(r.request.timeFilter).toBeUndefined();
    expect(r.changes).toEqual(["When: any time"]);
  });

  test("empty lists from a model do not clear an existing limit", () => {
    const base = applyPatch(request, {
      timeFilter: { days: ["sunday"] },
    }).request;
    const r = applyPatch(base, { timeFilter: { days: [], partsOfDay: [] } });
    expect(r.request.timeFilter).toEqual({ days: ["sunday"], partsOfDay: [] });
    expect(r.changes).toEqual([]);
  });

  test("a day asked for wins over a stray clear", () => {
    const r = applyPatch(request, {
      clearTimeFilter: true,
      timeFilter: { days: ["tomorrow"] },
    });
    expect(r.request.timeFilter?.days).toEqual(["tomorrow"]);
  });

  test("the budget override replaces the lowest member budget", () => {
    expect(effectiveBudgetCents(request)).toBe(2000);
    const r = applyPatch(request, { budgetCents: 3550 });
    expect(r.request.budgetCents).toBe(3550);
    expect(effectiveBudgetCents(r.request)).toBe(3550);
    expect(r.changes).toEqual(["Budget: $35.50 per person, was $20"]);
  });

  test("radius, location and filter modes", () => {
    const r = applyPatch(request, {
      radiusKm: 25,
      areaId: "kitchener",
      filterModes: { budget: "prefer", area: "hard" },
    });
    expect(r.request.radiusKm).toBe(25);
    expect(r.request.areaId).toBe("kitchener");
    expect(r.request.filterModes.budget).toBe("prefer");
    expect(r.request.filterModes.area).toBe("hard");
    expect(r.changes).toEqual([
      "Radius: 25 km, was 15 km",
      `Location: ${areaById("kitchener").name}, was ${areaById("uptown").name}`,
      "Budget is now a preference",
      "Location is now a must-have",
    ]);
  });

  test("an unknown area is ignored, not invented", () => {
    const r = applyPatch(request, { areaId: "atlantis" });
    expect(r.changes).toEqual([]);
    expect(r.request.areaId).toBe("uptown");
  });

  test("does not modify the plan it was given", () => {
    const before = structuredClone(request);
    applyPatch(request, { query: "x", budgetCents: 9900, radiusKm: 5 });
    expect(request).toEqual(before);
  });

  test("an out-of-range value fails instead of producing a bad plan", () => {
    expect(() => applyPatch(request, { budgetCents: -500 })).toThrow();
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
    expect(r.request.timeFilter?.days).toEqual(["sunday"]);
    expect(r.request.budgetCents).toBe(3000); // $20 * 1.5
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

  test("a named amount, a radius and an area", async () => {
    const r = await changePlan(
      request,
      `find it in ${areaById("kitchener").name}, within 30 km, budget of 45`,
      llm(),
    );
    expect(r.request.budgetCents).toBe(4500);
    expect(r.request.radiusKm).toBe(30);
    expect(r.request.areaId).toBe("kitchener");
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
        e("areaId", "Kitchener"),
        e("budgetMode", "prefer"),
        e("areaMode", "hard"),
      ],
    });
    expect(patch).toEqual({
      query: "hotpot",
      timeFilter: { days: ["sunday"], partsOfDay: ["evening"] },
      budgetCents: 3000,
      radiusKm: 25,
      areaId: "kitchener",
      filterModes: { budget: "prefer", area: "hard" },
    });
  });

  test("several days become one list", () => {
    expect(
      editsToPatch({ edits: [e("days", "saturday"), e("days", "sunday")] })
        .timeFilter?.days,
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
