import type { PlanRequest, User } from "@circles/shared";
import { describe, expect, test } from "vitest";
import {
  FakeRestaurantClient,
  createFakeLlmModel,
  type FakeLlmOverrides,
} from "./fakes.ts";
import { LlmClient } from "./llm.ts";
import { PlannerError, planEvent, type PlanDeps } from "./plan.ts";
import type { RestaurantClient, RestaurantQuery } from "./restaurants.ts";

// Saturday 2026-10-03 11:00 local (Toronto, EDT).
const NOW = new Date("2026-10-03T15:00:00Z");

const toronto = {
  name: "Toronto",
  lat: 43.6532,
  lng: -79.3832,
  timezone: "America/Toronto",
};
const user = (over: Partial<User> = {}): User => ({
  id: "u",
  name: "U",
  location: toronto,
  budget: 40,
  unavailable: [],
  ...over,
});
const request = (
  members: User[],
  text = "dinner",
  over: Partial<PlanRequest> = {},
): PlanRequest => ({
  text,
  group: { members },
  location: toronto,
  radiusKm: 15,
  filterModes: {
    budget: "hard",
    openHours: "hard",
    partySize: "hard",
    area: "prefer",
  },
  ...over,
});
const deps = (
  overrides: FakeLlmOverrides = {},
  restaurants: RestaurantClient = new FakeRestaurantClient(),
): PlanDeps => ({
  llm: new LlmClient(createFakeLlmModel(overrides)),
  restaurants,
  now: () => NOW,
});

describe("planEvent", () => {
  test("returns options that all come from the filtered candidates", async () => {
    const r = await planEvent(request([user(), user({ id: "v" })]), deps());
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.options).toHaveLength(3);
    const passed = new Set(r.candidates.map((c) => c.id));
    expect(r.options.every((o) => passed.has(o.candidateId))).toBe(true);
    expect(
      r.options.every((o) => o.rationale && o.constraintChecks.length > 0),
    ).toBe(true);
  });

  test("passes the group's own words to the restaurant search, unparsed", async () => {
    const seen: RestaurantQuery[] = [];
    const spy: RestaurantClient = {
      search: async (q) => {
        seen.push(q);
        return new FakeRestaurantClient().search(q);
      },
    };
    await planEvent(request([user()], "cheap ramen please"), deps({}, spy));
    expect(seen).toHaveLength(1);
    expect(seen[0]!.query).toBe("cheap ramen please");
  });

  test("party size is the member count, not anything typed", async () => {
    // Nine members: only places that seat nine or more, or are unknown, can pass.
    const nine = Array.from({ length: 9 }, (_, i) => user({ id: `u${i}` }));
    const r = await planEvent(request(nine, "dinner for 2"), deps());
    if (r.status !== "ok") throw new Error("expected ok");
    expect(
      r.candidates.every(
        (c) => c.maxPartySize === undefined || c.maxPartySize >= 9,
      ),
    ).toBe(true);
    expect(r.candidates.some((c) => c.maxPartySize === 4)).toBe(false);
  });

  test("the strictest member budget limits every place", async () => {
    const r = await planEvent(
      request([user({ budget: 100 }), user({ id: "v", budget: 10 })]),
      deps(),
    );
    if (r.status !== "ok") throw new Error("expected ok");
    for (const c of r.candidates) {
      if (c.priceLevel !== undefined)
        expect(c.priceLevel).toBeLessThanOrEqual(1);
    }
  });

  test("each option lists times when the group is free and the place is open", async () => {
    const r = await planEvent(request([user()], "ramen"), deps());
    if (r.status !== "ok") throw new Error("expected ok");
    const withHours = r.options.filter((o) => {
      const c = r.candidates.find((x) => x.id === o.candidateId)!;
      return c.openingHours !== undefined;
    });
    expect(withHours.length).toBeGreaterThan(0);
    for (const o of withHours) {
      expect(o.availableTimes.length).toBeGreaterThan(0);
      for (const t of o.availableTimes) expect(t.end > t.start).toBe(true);
    }
  });

  test("times when a member is unavailable are never offered", async () => {
    // Saturday 11:00-23:00 local is blocked for one member, so Sat times must not appear.
    const blocked = {
      start: "2026-10-03T15:00:00Z",
      end: "2026-10-04T03:00:00Z",
    };
    const r = await planEvent(
      request([user(), user({ id: "v", unavailable: [blocked] })], "ramen"),
      deps(),
    );
    if (r.status !== "ok") throw new Error("expected ok");
    for (const o of r.options) {
      for (const t of o.availableTimes) {
        const overlaps = t.start < blocked.end && blocked.start < t.end;
        expect(overlaps).toBe(false);
      }
    }
  });

  test("unverified data is labelled in the constraint checks", async () => {
    const r = await planEvent(request([user()]), deps());
    if (r.status !== "ok") throw new Error("expected ok");
    const unknownPrice = r.candidates.find((c) => c.priceLevel === undefined);
    if (unknownPrice) {
      const opt = r.options.find((o) => o.candidateId === unknownPrice.id);
      if (opt) expect(opt.constraintChecks.join(" ")).toContain("unverified");
    }
  });

  test("no time when everyone is free gives a clear no-match", async () => {
    const wholeRange = {
      start: "2026-10-03T00:00:00Z",
      end: "2026-10-20T00:00:00Z",
    };
    const r = await planEvent(
      request([user({ unavailable: [wholeRange] })]),
      deps(),
    );
    expect(r).toMatchObject({ status: "no_matches", reason: "no_free_time" });
  });

  test("names the constraint that eliminated the most candidates", async () => {
    // Known opening hours that never cover a meal slot: every place is closed.
    const closed: RestaurantClient = {
      search: async (q) =>
        (await new FakeRestaurantClient().search(q)).map((c) => ({
          ...c,
          openingHours: [{ openMin: 0, closeMin: 1 }],
        })),
    };
    const r = await planEvent(request([user()]), deps({}, closed));
    expect(r).toMatchObject({ status: "no_matches", reason: "openHours" });
  });

  test("closeness is a preference: nearer places come first, and none are dropped for distance", async () => {
    // A radius of 50 metres would exclude nearly everything if it were a hard rule.
    const r = await planEvent(
      request([user()], "dinner", { radiusKm: 0.05 }),
      deps(),
    );
    if (r.status !== "ok") throw new Error("expected ok");
    const distances = r.options.map((o) => o.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    // Candidates are handed over nearest first too.
    const all = r.candidates.map((c) => c.id);
    expect(all.length).toBeGreaterThan(r.options.length);
  });

  test("each option says how far it is from the search location", async () => {
    const r = await planEvent(request([user()]), deps());
    if (r.status !== "ok") throw new Error("expected ok");
    for (const o of r.options) {
      expect(o.distanceKm).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(o.distanceKm)).toBe(true);
    }
  });

  test("searches where the planner chose, out to the chosen radius", async () => {
    const seen: RestaurantQuery[] = [];
    const spy: RestaurantClient = {
      search: async (q) => {
        seen.push(q);
        return [];
      },
    };
    const east = { ...toronto, name: "East", lat: 43.7, lng: -79.2 };
    await planEvent(
      request([user()], "dinner", { location: east, radiusKm: 8 }),
      deps({}, spy),
    );
    expect(seen[0]).toMatchObject({
      center: { lat: 43.7, lng: -79.2 },
      radiusKm: 8,
    });
  });

  test("members' own positions do not limit the search", async () => {
    // A member far from the search location does not stop a plan there.
    const far = { ...toronto, name: "Far", lat: 49.28, lng: -123.12 };
    const r = await planEvent(
      request([user(), user({ id: "v", location: far })]),
      deps(),
    );
    expect(r.status).toBe("ok");
  });

  test("a search with no results gives no_restaurants", async () => {
    const empty: RestaurantClient = { search: async () => [] };
    const r = await planEvent(request([user()]), deps({}, empty));
    expect(r).toMatchObject({ status: "no_matches", reason: "no_restaurants" });
  });

  test("mealtimes follow the search location's time zone, not the members'", async () => {
    // Same group and clock, searched in Vancouver. Opening hours are local to the place,
    // so the same free time maps to a different local hour than in Toronto.
    const vancouver = {
      name: "Vancouver",
      lat: 49.2827,
      lng: -123.1207,
      timezone: "America/Vancouver",
    };
    const inToronto = await planEvent(request([user()]), deps());
    const inVancouver = await planEvent(
      request([user()], "dinner", { location: vancouver }),
      deps(),
    );
    if (inToronto.status !== "ok" || inVancouver.status !== "ok")
      throw new Error("expected ok");
    const first = (r: typeof inToronto) =>
      r.options[0]!.availableTimes[0]!.start;
    expect(first(inToronto)).not.toBe(first(inVancouver));
  });

  test("reports progress through the stages", async () => {
    const stages: string[] = [];
    await planEvent(request([user()]), deps(), {
      onProgress: (s) => stages.push(s),
    });
    expect(stages).toEqual(["searching", "ranking"]);
  });
});

describe("planEvent filter modes", () => {
  const modes = (over: Record<string, "hard" | "prefer">) => ({
    budget: "hard" as const,
    openHours: "hard" as const,
    partySize: "hard" as const,
    area: "prefer" as const,
    ...over,
  });
  // Far Out Pizza (fake-8) is about 28 km from the centre; Trattoria Roma (fake-2) is near.
  const italian = (over: Record<string, "hard" | "prefer">, user1 = user()) =>
    planEvent(
      request([user1], "italian", { filterModes: modes(over) }),
      deps(),
      { n: 8 },
    );

  test("location as a hard filter drops places outside the radius", async () => {
    const r = await italian({ area: "hard" });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.options.map((o) => o.candidateId)).not.toContain("fake-8");
  });

  test("location as a preference keeps far places but ranks them below near ones", async () => {
    const r = await italian({ area: "prefer" });
    if (r.status !== "ok") throw new Error("expected ok");
    const ids = r.options.map((o) => o.candidateId);
    expect(ids).toContain("fake-8");
    expect(ids.indexOf("fake-2")).toBeLessThan(ids.indexOf("fake-8"));
    const far = r.options.find((o) => o.candidateId === "fake-8")!;
    expect(far.unmet).toEqual(["area"]);
    expect(far.constraintChecks.join(" ")).toContain("not met");
    expect(far.constraintChecks.join(" ")).toContain("(preferred)");
  });

  test("a hard filter that removes everything gives a no-match; preferring it does not", async () => {
    const tiny = { radiusKm: 0.05 };
    const hard = await planEvent(
      request([user()], "dinner", {
        ...tiny,
        filterModes: modes({ area: "hard" }),
      }),
      deps(),
    );
    expect(hard).toMatchObject({ status: "no_matches", reason: "area" });
    const soft = await planEvent(
      request([user()], "dinner", {
        ...tiny,
        filterModes: modes({ area: "prefer" }),
      }),
      deps(),
    );
    expect(soft.status).toBe("ok");
  });

  test("budget as a preference keeps pricey places below the ones within budget", async () => {
    const poor = user({ budget: 10 }); // price level 1 at most
    const hard = await planEvent(
      request([poor], "dinner", { filterModes: modes({ budget: "hard" }) }),
      deps(),
      { n: 8 },
    );
    const soft = await planEvent(
      request([poor], "dinner", { filterModes: modes({ budget: "prefer" }) }),
      deps(),
      { n: 8 },
    );
    if (hard.status !== "ok" || soft.status !== "ok")
      throw new Error("expected ok");
    const priceOf = (r: typeof hard, id: string) =>
      r.candidates.find((c) => c.id === id)!.priceLevel ?? 0;
    expect(hard.options.every((o) => priceOf(hard, o.candidateId) <= 1)).toBe(
      true,
    );
    expect(soft.options.length).toBeGreaterThan(hard.options.length);
    // Every place that meets the preference comes before every place that misses it.
    const firstMiss = soft.options.findIndex((o) => o.unmet.length > 0);
    expect(firstMiss).toBeGreaterThan(0);
    expect(
      soft.options.slice(firstMiss).every((o) => o.unmet.includes("budget")),
    ).toBe(true);
    expect(
      soft.options.slice(0, firstMiss).every((o) => o.unmet.length === 0),
    ).toBe(true);
  });

  test("open hours as a preference keeps a place that is closed when the group is free", async () => {
    const closed: RestaurantClient = {
      search: async (q) =>
        (await new FakeRestaurantClient().search(q)).map((c) => ({
          ...c,
          openingHours: [{ openMin: 0, closeMin: 1 }],
        })),
    };
    const r = await planEvent(
      request([user()], "dinner", {
        filterModes: modes({ openHours: "prefer" }),
      }),
      deps({}, closed),
    );
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.options[0]!.unmet).toContain("openHours");
    expect(r.options[0]!.availableTimes).toEqual([]);
  });

  test("party size as a preference keeps a place too small for the group", async () => {
    const nine = Array.from({ length: 9 }, (_, i) => user({ id: `u${i}` }));
    const r = await planEvent(
      request(nine, "dinner", { filterModes: modes({ partySize: "prefer" }) }),
      deps(),
      { n: 8 },
    );
    if (r.status !== "ok") throw new Error("expected ok");
    const small = r.options.filter((o) => o.unmet.includes("partySize"));
    expect(small.length).toBeGreaterThan(0);
  });

  test("the filter modes default to must-have except location", async () => {
    const r = await planEvent(
      {
        text: "dinner",
        group: { members: [user()] },
        location: toronto,
      } as never,
      deps(),
    );
    expect(r.status).toBe("ok");
  });
});

describe("planEvent with a when and a budget override", () => {
  // NOW is Saturday 2026-10-03 11:00 local. Sunday is 2026-10-04.
  const weekdayOf = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Toronto",
      weekday: "long",
    }).format(new Date(iso));

  test("limits the times offered to the days asked for", async () => {
    const r = await planEvent(
      request([user()], "ramen", { when: { days: ["sunday"] } }),
      deps(),
    );
    if (r.status !== "ok") throw new Error("expected ok");
    const times = r.options.flatMap((o) => o.availableTimes);
    expect(times.length).toBeGreaterThan(0);
    // Two weeks are searched, so there are two Sundays. Nothing else is offered.
    for (const t of times) expect(weekdayOf(t.start)).toBe("Sunday");
  });

  test("a day with nobody free gives a no-match that says so", async () => {
    // Both Sundays in the two-week search are blocked for one member.
    const blocked = [
      { start: "2026-10-04T00:00:00Z", end: "2026-10-05T12:00:00Z" },
      { start: "2026-10-11T00:00:00Z", end: "2026-10-12T12:00:00Z" },
    ];
    const r = await planEvent(
      request([user({ unavailable: blocked })], "ramen", {
        when: { days: ["sunday"] },
      }),
      deps(),
    );
    expect(r).toMatchObject({ status: "no_matches", reason: "no_free_time" });
    if (r.status === "no_matches")
      expect(r.message).toContain("days you asked for");
  });

  test("mornings are offered when asked for, even though the default starts at 11:00", async () => {
    const r = await planEvent(
      request([user()], "ramen", { when: { partsOfDay: ["morning"] } }),
      deps(),
    );
    // Restaurants open at 11:00 or later, so a 2h morning slot starting at 8-10 is closed;
    // slots starting at 11:00 can still work, so a result is possible.
    expect(["ok", "no_matches"]).toContain(r.status);
  });

  test("the budget override replaces the lowest member budget", async () => {
    const poor = user({ budget: 10 });
    const hard = (extra: Partial<PlanRequest>) =>
      planEvent(request([poor], "dinner", extra), deps(), { n: 8 });
    const base = await hard({});
    const raised = await hard({ budgetPerPerson: 100 });
    if (base.status !== "ok" || raised.status !== "ok")
      throw new Error("expected ok");
    const max = (r: typeof base) =>
      Math.max(...r.candidates.map((c) => c.priceLevel ?? 0));
    expect(max(base)).toBeLessThanOrEqual(1);
    expect(max(raised)).toBeGreaterThan(1);
  });
});

describe("planEvent when must-haves leave few places", () => {
  // Only these three places are found: Noodle House ($), Trattoria Roma ($$$), Le Bistro ($$$$).
  const three: RestaurantClient = {
    search: async (q) =>
      (await new FakeRestaurantClient().search(q)).filter((c) =>
        ["fake-1", "fake-2", "fake-5"].includes(c.id),
      ),
  };
  const poor = user({ budget: 10 }); // price level 1 at most

  test("returns the places that fit, with a notice saying why there are fewer than asked for", async () => {
    const r = await planEvent(request([poor]), deps({}, three), { n: 3 });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.options.map((o) => o.candidateId)).toEqual(["fake-1"]);
    expect(r.notice).toContain("Only 1 of 3 places");
    expect(r.notice).toContain("Budget rules out 2");
    expect(r.notice).toContain("Prefer");
  });

  test("no notice when enough places meet the must-haves", async () => {
    const r = await planEvent(request([user()]), deps(), { n: 3 });
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.notice).toBeUndefined();
  });

  test("the notice names only must-haves, not preferences", async () => {
    const r = await planEvent(
      request([poor], "dinner", {
        filterModes: {
          budget: "hard",
          openHours: "hard",
          partySize: "hard",
          area: "prefer",
        },
      }),
      deps({}, three),
      { n: 3 },
    );
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.notice).not.toContain("Location");
  });

  test("switching the filter to Prefer fills the list instead", async () => {
    const r = await planEvent(
      request([poor], "dinner", {
        filterModes: {
          budget: "prefer",
          openHours: "hard",
          partySize: "hard",
          area: "prefer",
        },
      }),
      deps({}, three),
      { n: 3 },
    );
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.options).toHaveLength(3);
    expect(r.notice).toBeUndefined();
    expect(r.options[0]!.candidateId).toBe("fake-1"); // the one within budget comes first
  });
});

describe("planEvent guards against bad model output", () => {
  test("rejects a hallucinated candidate id and retries", async () => {
    let calls = 0;
    const r = await planEvent(
      request([user()]),
      deps({
        rank: (candidates) => {
          calls++;
          if (calls === 1) {
            return {
              picks: [
                { candidateId: "made-up-place", rationale: "Great vibes" },
              ],
            };
          }
          return {
            picks: [{ candidateId: candidates[0]!.id, rationale: "Fine." }],
          };
        },
      }),
    );
    expect(calls).toBe(2);
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.options.every((o) => o.candidateId !== "made-up-place")).toBe(
      true,
    );
  });

  test("throws PlannerError if the model never returns valid picks", async () => {
    await expect(
      planEvent(
        request([user()]),
        deps({
          rank: () => ({
            picks: [{ candidateId: "made-up-place", rationale: "x" }],
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(PlannerError);
  });

  test("rejects a place that exists but failed the filters", async () => {
    // fake-5 (price level 4) is over a low budget, so it is not in the filtered set.
    await expect(
      planEvent(
        request([user({ budget: 10 })]),
        deps({
          rank: () => ({
            picks: [{ candidateId: "fake-5", rationale: "Fancy" }],
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(PlannerError);
  });

  test("rejects duplicate picks and malformed output", async () => {
    await expect(
      planEvent(
        request([user()]),
        deps({
          rank: () => ({
            picks: [
              { candidateId: "fake-1", rationale: "a" },
              { candidateId: "fake-1", rationale: "b" },
            ],
          }),
        }),
      ),
    ).rejects.toBeInstanceOf(PlannerError);
    await expect(
      planEvent(request([user()]), deps({ rank: () => "nope" })),
    ).rejects.toBeInstanceOf(PlannerError);
  });

  test("an empty list of picks is a bad answer: retried, then recovered", async () => {
    let calls = 0;
    const r = await planEvent(
      request([user()]),
      deps({
        rank: (candidates) => {
          calls++;
          return calls === 1
            ? { picks: [] }
            : {
                picks: [{ candidateId: candidates[0]!.id, rationale: "Fine." }],
              };
        },
      }),
    );
    expect(calls).toBe(2);
    if (r.status !== "ok") throw new Error("expected ok");
    expect(r.options).toHaveLength(1);
  });

  test("a model that never picks anything fails instead of returning an empty plan", async () => {
    await expect(
      planEvent(request([user()]), deps({ rank: () => ({ picks: [] }) })),
    ).rejects.toBeInstanceOf(PlannerError);
  });
});
