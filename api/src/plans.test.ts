import {
  FakeRestaurantClient,
  LlmClient,
  createFakeLlmModel,
  type PlanDeps,
  type RestaurantClient,
} from "@circles/ai";
import type { PlanJob, PlanRequest } from "@circles/shared";
import { describe, expect, test } from "vitest";
import { PlanStore } from "./plans.ts";

const toronto = {
  name: "Toronto",
  lat: 43.6532,
  lng: -79.3832,
  timezone: "America/Toronto",
};

const request: PlanRequest = {
  text: "ramen",
  location: toronto,
  radiusKm: 15,
  filterModes: {
    budget: "hard",
    openHours: "hard",
    partySize: "hard",
    area: "prefer",
  },
  group: {
    members: [
      {
        id: "u",
        name: "U",
        location: {
          name: "Toronto",
          lat: 43.6532,
          lng: -79.3832,
          timezone: "America/Toronto",
        },
        budget: 40,
        unavailable: [],
      },
    ],
  },
};

const fakeDeps = (
  restaurants: RestaurantClient = new FakeRestaurantClient(),
): PlanDeps => ({
  llm: new LlmClient(createFakeLlmModel()),
  restaurants,
});

/** Resolves with the plan once it finishes. */
const finished = (store: PlanStore, id: string) =>
  new Promise<PlanJob>((resolve) => {
    const done = (j: PlanJob) => {
      if (j.status === "done" || j.status === "failed") {
        unsubscribe();
        resolve(j);
      }
    };
    const unsubscribe = store.subscribe(id, done);
    const now = store.get(id);
    if (now) done(now);
  });

/** A restaurant client that waits for release(), to hold plans in the running state. */
function gatedRestaurants() {
  const inner = new FakeRestaurantClient();
  let release = () => {};
  const gate = new Promise<void>((r) => (release = r));
  let started = 0;
  const client: RestaurantClient = {
    search: async (q) => {
      started++;
      await gate;
      return inner.search(q);
    },
  };
  return { client, release: () => release(), started: () => started };
}

describe("PlanStore", () => {
  test("submit returns a pending plan immediately, which later finishes", async () => {
    const store = new PlanStore({ deps: fakeDeps() });
    const job = store.submit(request);
    expect(job.status).toBe("pending");
    const final = await finished(store, job.id);
    expect(final.status).toBe("done");
    expect(
      final.result?.status === "ok" || final.result?.status === "no_matches",
    ).toBe(true);
  });

  test("subscribers see the pipeline's later stages as it moves", async () => {
    const store = new PlanStore({ deps: fakeDeps() });
    const job = store.submit(request);
    const stages = new Set<string | undefined>();
    store.subscribe(job.id, (j) => stages.add(j.stage));
    await finished(store, job.id);
    // "searching" is reported before a subscriber can attach, so only later stages show.
    expect(stages).toContain("ranking");
  });

  test("a failing plan is marked failed with a safe message", async () => {
    const boom: RestaurantClient = {
      search: async () => {
        throw new Error(
          "secret internal detail https://places.googleapis.com?key=abc",
        );
      },
    };
    const store = new PlanStore({ deps: fakeDeps(boom) });
    const final = await finished(store, store.submit(request).id);
    expect(final.status).toBe("failed");
    expect(final.error).toBe("Planning failed.");
  });

  test("a plan that runs too long is marked failed", async () => {
    const gate = gatedRestaurants();
    const store = new PlanStore({ deps: fakeDeps(gate.client), timeoutMs: 20 });
    const final = await finished(store, store.submit(request).id);
    expect(final.status).toBe("failed");
    expect(final.error).toBe("Planning took too long.");
    gate.release();
  });

  test("only maxConcurrent plans run at once; the rest wait their turn", async () => {
    const gate = gatedRestaurants();
    const store = new PlanStore({
      deps: fakeDeps(gate.client),
      maxConcurrent: 1,
    });
    const a = store.submit(request);
    const b = store.submit(request);
    await new Promise((r) => setTimeout(r, 30));
    expect(gate.started()).toBe(1);
    expect(store.get(b.id)?.status).toBe("pending");
    gate.release();
    expect((await finished(store, a.id)).status).toBe("done");
    expect((await finished(store, b.id)).status).toBe("done");
  });

  test("unsubscribe stops notifications", async () => {
    const store = new PlanStore({ deps: fakeDeps() });
    const job = store.submit(request);
    let calls = 0;
    const off = store.subscribe(job.id, () => calls++);
    off();
    await finished(store, job.id);
    expect(calls).toBe(0);
  });

  test("old finished plans are evicted past the cap", async () => {
    const store = new PlanStore({ deps: fakeDeps(), maxJobs: 2 });
    const first = store.submit(request);
    await finished(store, first.id);
    const second = store.submit(request);
    await finished(store, second.id);
    const third = store.submit(request);
    await finished(store, third.id);
    expect(store.get(first.id)).toBeUndefined();
    expect(store.get(third.id)).toBeDefined();
  });
});
