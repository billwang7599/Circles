import type { PlanView } from "@circles/shared";
import { beforeAll, expect, test } from "vitest";
import { fakePlaces } from "./plan/fakes.ts";
import type { PlacesClient } from "./plan/places.ts";
import { attending, testApp, type TestApp } from "./testApp.ts";

let call: TestApp["call"];
let register: TestApp["register"];
let circleId: string;
let nicky: string;
let bill: string;
let whileSearching: (() => Promise<unknown>) | undefined;
let createPlan: () => Promise<string>;

const places: PlacesClient = {
  async search(query, area) {
    await whileSearching?.();
    return fakePlaces().search(query, area);
  },
};

const view = async (path: string) =>
  (await (await call("GET", path, nicky)).json()) as PlanView;

beforeAll(async () => {
  const t = await testApp({ places });
  ({ call, register } = t);
  const circle = await t.circleWith("Nicky", "Bill");
  circleId = circle.circleId;
  [nicky, bill] = circle.tokens;
  createPlan = async () =>
    `/api/circles/${circleId}/plans/${(await t.createPlan(circleId, nicky)).id}`;
});

test("fewer than two attending is 422", async () => {
  const path = await createPlan();
  await register(path, nicky, attending(3000, "ramen"));
  await register(path, bill, { attending: false, busy: [], preferences: [] });
  const res = await call("POST", `${path}/options`, nicky);
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({
    error: "Need at least two people in",
    reason: "need_two",
  });
});

test("a registration saved while generating is 409 and nothing is written", async () => {
  const path = await createPlan();
  await register(path, nicky, attending(3000, "sushi"));
  await register(path, bill, attending(3000, "sushi"));
  whileSearching = () => register(path, bill, attending(3000, "ramen"));
  const res = await call("POST", `${path}/options`, nicky);
  whileSearching = undefined;
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "Inputs changed, try again" });
  expect((await view(path)).options).toEqual([]);
});

test("options carry no budget or price level", async () => {
  const path = await createPlan();
  await register(path, nicky, attending(12345, "ramen"));
  await register(path, bill, attending(67890, "sushi"));
  const res = await call("POST", `${path}/options`, nicky);
  expect(res.status).toBe(201);
  const body = await res.text();
  expect(body).not.toMatch(/\b67890\b|priceLevel/);
  const generated = JSON.parse(body) as PlanView;
  expect(generated.plan.phase).toEqual({ kind: "open", options: "fresh" });
  expect(generated.options.map((o) => o.rank)).toEqual([1, 2, 3]);
});

test("anyone can get the first options; only the initiator can get new ones", async () => {
  const path = await createPlan();
  await register(path, nicky, attending(3000, "ramen"));
  await register(path, bill, attending(3000, "sushi"));
  expect((await call("POST", `${path}/options`, bill)).status).toBe(201);
  const res = await call("POST", `${path}/options`, bill);
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({
    error: "Only the initiator can get new options",
  });
  expect((await call("POST", `${path}/options`, nicky)).status).toBe(201);
});
