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
  budget: 40,
  maxDistanceKm: 10,
  unavailable: [],
};
const group = {
  city: "toronto",
  timezone: "America/Toronto",
  members: [member],
};

describe("POST /plan", () => {
  test("returns options from the planner", async () => {
    const res = await post({ text: "dinner", group });
    expect(res.status).toBe(200);
    const body = await res.json();
    // The result is either options or a clear no-match, depending on the clock.
    expect(["ok", "no_matches"]).toContain(body.status);
  });
  test("rejects an invalid body", async () => {
    expect((await post({ text: "dinner" })).status).toBe(400);
    expect((await post({ text: "", group })).status).toBe(400);
    const res = await app.request("/plan", {
      method: "POST",
      body: "not json",
    });
    expect(res.status).toBe(400);
  });
  test("rejects an unknown city", async () => {
    expect(
      (await post({ text: "dinner", group: { ...group, city: "atlantis" } }))
        .status,
    ).toBe(400);
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
    const res = await send(app, { text: "dinner", group });
    expect(res.status).toBe(202);
    const job = await res.json();
    expect(job.id).toBeTruthy();
    expect(["pending", "running", "done"]).toContain(job.status);
    const got = await app.request(`/plans/${job.id}`);
    expect(got.status).toBe(200);
  });

  test("rejects an invalid body and an unknown city", async () => {
    expect((await send(app, { text: "dinner" })).status).toBe(400);
    expect(
      (await send(app, { text: "x", group: { ...group, city: "atlantis" } }))
        .status,
    ).toBe(400);
  });

  test("unknown plan ids are 404", async () => {
    expect((await app.request("/plans/nope")).status).toBe(404);
    expect((await app.request("/plans/nope/events")).status).toBe(404);
  });

  test("the event stream sends updates and ends on the final one", async () => {
    const job = await (await send(app, { text: "ramen", group })).json();
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
    const job = await (await send(app, { text: "ramen", group })).json();
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
    const job = await (await send(slowApp, { text: "ramen", group })).json();
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
