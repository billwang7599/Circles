import {
  FakeRestaurantClient,
  LlmClient,
  createFakeLlmModel,
  type RestaurantClient,
} from "@circles/ai";
import { describe, expect, test } from "vitest";
import { createApp } from "./app.ts";

// Always the fakes, so tests never call a real service even if credentials are in the environment.
const app = createApp({
  llm: new LlmClient(createFakeLlmModel()),
  restaurants: new FakeRestaurantClient(),
});
const post = (body: unknown) =>
  app.request("/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const member = {
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
};
const group = { members: [member] };
const location = member.location;

describe("POST /plan", () => {
  test("returns options from the planner", async () => {
    const res = await post({ text: "dinner", group, location });
    expect(res.status).toBe(200);
    const body = await res.json();
    // The result is either options or a clear no-match, depending on the clock.
    expect(["ok", "no_matches"]).toContain(body.status);
  });
  test("rejects an invalid body", async () => {
    expect((await post({ text: "dinner" })).status).toBe(400);
    expect((await post({ text: "", group, location })).status).toBe(400);
    const res = await app.request("/plan", {
      method: "POST",
      body: "not json",
    });
    expect(res.status).toBe(400);
  });
  test("accepts members in different time zones", async () => {
    const vancouver = {
      ...member,
      id: "v",
      location: {
        name: "Vancouver",
        lat: 49.28,
        lng: -123.12,
        timezone: "America/Vancouver",
      },
    };
    const res = await post({
      text: "dinner",
      group: { members: [member, vancouver] },
      location,
    });
    expect(res.status).toBe(200);
  });
  test("health check", async () => {
    expect((await app.request("/health")).status).toBe(200);
  });
});

describe("background plans", () => {
  const send = (a: ReturnType<typeof createApp>, body: unknown) =>
    a.request("/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  /** Read an event stream to the end and return its text. */
  async function readStream(res: Response) {
    return await res.text();
  }

  test("POST /plans returns 202 with an id, and GET shows the plan", async () => {
    const res = await send(app, { text: "dinner", group, location });
    expect(res.status).toBe(202);
    const job = await res.json();
    expect(job.id).toBeTruthy();
    expect(["pending", "running", "done"]).toContain(job.status);
    const got = await app.request(`/plans/${job.id}`);
    expect(got.status).toBe(200);
  });

  test("rejects an invalid body", async () => {
    expect((await send(app, { text: "dinner" })).status).toBe(400);
    expect(
      (await send(app, { text: "x", group: { members: [] } })).status,
    ).toBe(400);
  });

  test("rejects a missing location or a radius over 50 km", async () => {
    expect((await send(app, { text: "dinner", group })).status).toBe(400);
    expect(
      (await send(app, { text: "dinner", group, location, radiusKm: 80 }))
        .status,
    ).toBe(400);
  });

  test("accepts per-filter modes and rejects an unknown mode", async () => {
    const ok = await send(app, {
      text: "dinner",
      group,
      location,
      filterModes: { area: "hard", budget: "prefer" },
    });
    expect(ok.status).toBe(202);
    const bad = await send(app, {
      text: "dinner",
      group,
      location,
      filterModes: { area: "maybe" },
    });
    expect(bad.status).toBe(400);
  });

  test("unknown plan ids are 404", async () => {
    expect((await app.request("/plans/nope")).status).toBe(404);
    expect((await app.request("/plans/nope/events")).status).toBe(404);
  });

  test("the event stream sends updates and ends on the final one", async () => {
    const job = await (
      await send(app, { text: "ramen", group, location })
    ).json();
    const res = await app.request(`/plans/${job.id}/events`);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await readStream(res);
    const updates = text
      .split("\n\n")
      .filter((chunk) => chunk.includes("event: update"))
      .map((chunk) => JSON.parse(chunk.split("data: ")[1]!));
    expect(updates.length).toBeGreaterThan(0);
    expect(updates.at(-1).status).toBe("done");
  });

  test("a finished plan streams its final state at once and closes", async () => {
    const job = await (
      await send(app, { text: "ramen", group, location })
    ).json();
    await readStream(await app.request(`/plans/${job.id}/events`)); // wait for done
    const again = await readStream(
      await app.request(`/plans/${job.id}/events`),
    );
    expect(again).toContain('"status":"done"');
  });

  test("a quiet stream sends keep-alive pings", async () => {
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const slow: RestaurantClient = {
      search: async (q) => {
        await gate;
        return new FakeRestaurantClient().search(q);
      },
    };
    const slowApp = createApp(
      { llm: new LlmClient(createFakeLlmModel()), restaurants: slow },
      { heartbeatMs: 15 },
    );
    const job = await (
      await send(slowApp, { text: "ramen", group, location })
    ).json();
    const res = await slowApp.request(`/plans/${job.id}/events`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let seen = "";
    while (!seen.includes(": ping")) {
      const { value, done } = await reader.read();
      if (done) break;
      seen += decoder.decode(value);
    }
    expect(seen).toContain(": ping");
    release();
    await reader.cancel();
  });
});

describe("POST /plans/chat", () => {
  const request = { text: "buffet", group, location, radiusKm: 15 };
  const chat = (message: string, over: Record<string, unknown> = {}) =>
    app.request("/plans/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, request, ...over }),
    });

  test("a change request returns the changes and starts a new run", async () => {
    const res = await chat(
      "find hotpot instead of buffet, on sunday, with an increased budget",
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.changed).toBe(true);
    expect(body.request.text).toBe("hotpot");
    expect(body.request.when.days).toEqual(["sunday"]);
    expect(body.request.budgetPerPerson).toBe(60); // 40 * 1.5
    expect(body.changes).toHaveLength(3);
    expect(body.job.id).toBeTruthy();
    expect((await app.request(`/plans/${body.job.id}`)).status).toBe(200);
  });

  test("a message that asks for nothing changes nothing and starts no run", async () => {
    const res = await chat("thanks!");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ changed: false, changes: [] });
    expect(body.job).toBeUndefined();
  });

  test("rejects an empty message or a missing request", async () => {
    expect((await chat("   ")).status).toBe(400);
    expect((await chat("hello", { request: undefined })).status).toBe(400);
  });

  test("a model that never gives a usable answer is a 502", async () => {
    const broken = createApp({
      llm: new LlmClient(
        createFakeLlmModel({ interpret: () => ({ radiusKm: 9999 }) }),
      ),
      restaurants: new FakeRestaurantClient(),
    });
    const res = await broken.request("/plans/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "bigger radius", request }),
    });
    expect(res.status).toBe(502);
  });
});
