import { randomUUID } from "node:crypto";
import {
  addDays,
  datesIn,
  type CircleView,
  type Part,
  type When,
  type PlanView,
  type RegistrationInput,
} from "@circles/shared";
import { beforeAll, expect, test } from "vitest";
import type { Db } from "./db.ts";
import { attending, testApp, type TestApp } from "./testApp.ts";

let call: TestApp["call"];
let db: Db;
let circleId: string;
let nicky: string;
let bill: string;
let createPlan: (
  when: When,
  parts?: Part[],
) => ReturnType<TestApp["createPlan"]>;
let planWithOptions: () => ReturnType<TestApp["planWithOptions"]>;

beforeAll(async () => {
  const t = await testApp();
  ({ call, db } = t);
  const circle = await t.circleWith("Nicky", "Bill");
  circleId = circle.circleId;
  [nicky, bill] = circle.tokens;
  createPlan = (when, parts) => t.createPlan(circleId, nicky, when, parts);
  planWithOptions = () => t.planWithOptions(circleId, [nicky, bill]);
});

test("another member's budget and busy times never appear in the plan body", async () => {
  const plan = await createPlan("week");
  const dates = datesIn(plan.windowStart, plan.windowEnd);
  const inputs: [string, RegistrationInput][] = [
    [
      nicky,
      {
        attending: true,
        budgetCents: 12345,
        busy: [{ date: dates[1], part: "evening" }],
        preferences: ["ramen"],
      },
    ],
    [
      bill,
      {
        attending: true,
        budgetCents: 67890,
        busy: [{ date: dates[2], part: "morning" }],
        preferences: ["sushi"],
      },
    ],
  ];
  const path = `/api/circles/${circleId}/plans/${plan.id}`;
  for (const [token, input] of inputs) {
    const res = await call("PUT", `${path}/registration`, token, input);
    expect(res.status).toBe(200);
  }
  for (const [token, own] of inputs) {
    const other = inputs.find(([t]) => t !== token)![1];
    const res = await call("GET", path, token);
    expect(res.status).toBe(200);
    const text = await res.text();
    const view = JSON.parse(text) as PlanView;
    expect(view.me.registration).toEqual(own);
    expect(view.members.every((m) => m.registered && m.attending)).toBe(true);
    expect(text).not.toMatch(new RegExp(`\\b${other.budgetCents}\\b`));
    expect(text).not.toContain(other.busy[0].date);
  }
});

test("a busy date outside the window is 400", async () => {
  const plan = await createPlan("today");
  const res = await call(
    "PUT",
    `/api/circles/${circleId}/plans/${plan.id}/registration`,
    bill,
    {
      attending: true,
      budgetCents: 2000,
      busy: [{ date: "2000-01-01", part: "morning" }],
      preferences: [],
    },
  );
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "Busy date outside the window" });
});

test("the initiator deletes a plan; another member is 403", async () => {
  const plan = await createPlan("week");
  const path = `/api/circles/${circleId}/plans/${plan.id}`;
  const refused = await call("DELETE", path, bill);
  expect(refused.status).toBe(403);
  expect(await refused.json()).toEqual({
    error: "Only the initiator can delete this plan",
  });
  const res = await call("DELETE", path, nicky);
  expect(res.status).toBe(200);
  expect((await call("GET", path, nicky)).status).toBe(404);
  const circle = (await (
    await call("GET", `/api/circles/${circleId}`, nicky)
  ).json()) as CircleView;
  expect(circle.plans.map((p) => p.id)).not.toContain(plan.id);
});

test("the initiator edits a plan; moving its window clears options and busy dates outside it", async () => {
  const { path, view } = await planWithOptions();
  const dates = datesIn(view.plan.windowStart, view.plan.windowEnd);
  const busy = await call("PUT", `${path}/registration`, bill, {
    attending: true,
    budgetCents: 3000,
    busy: [{ date: dates[1], part: "evening" }],
    preferences: [],
  });
  expect(busy.status).toBe(200);

  const same = {
    title: "Ramen night",
    areaId: "uw",
    windowStart: view.plan.windowStart,
    windowEnd: view.plan.windowEnd,
    parts: view.plan.parts,
  };
  const refused = await call("PUT", path, bill, same);
  expect(refused.status).toBe(403);
  expect(await refused.json()).toEqual({
    error: "Only the initiator can edit this plan",
  });

  const renamed = await call("PUT", path, nicky, same);
  expect(renamed.status).toBe(200);
  const afterRename = (await renamed.json()) as PlanView;
  expect(afterRename.plan.title).toBe("Ramen night");
  expect(afterRename.plan.windowEnd).toBe(view.plan.windowEnd);
  expect(afterRename.plan.phase).toEqual({ kind: "open", options: "stale" });
  expect(afterRename.options.map((o) => o.id)).toEqual(
    view.options.map((o) => o.id),
  );

  const moved = await call("PUT", path, nicky, {
    ...same,
    windowEnd: view.plan.windowStart,
  });
  expect(moved.status).toBe(200);
  const afterMove = (await moved.json()) as PlanView;
  expect(afterMove.plan.windowEnd).toBe(afterMove.plan.windowStart);
  expect(afterMove.options).toEqual([]);
  const bills = (await (await call("GET", path, bill)).json()) as PlanView;
  expect(bills.me.registration).toMatchObject({
    attending: true,
    budgetCents: 3000,
    busy: [],
  });
});

test("a plan keeps the chosen window and times of day; a past start or a long window is 400", async () => {
  const plan = await createPlan("week", ["evening", "morning"]);
  expect(plan.parts).toEqual(["morning", "evening"]);
  const post = (body: object) =>
    call("POST", `/api/circles/${circleId}/plans`, nicky, {
      title: "Ramen",
      areaId: "uw",
      parts: ["evening"],
      ...body,
    });
  const past = await post({
    windowStart: addDays(plan.windowStart, -1),
    windowEnd: plan.windowStart,
  });
  expect(past.status).toBe(400);
  expect(await past.json()).toEqual({
    error: "The plan can't start in the past",
  });
  const long = await post({
    windowStart: plan.windowStart,
    windowEnd: addDays(plan.windowStart, 15),
  });
  expect(long.status).toBe(400);
  const none = await post({
    windowStart: plan.windowStart,
    windowEnd: plan.windowStart,
    parts: [],
  });
  expect(none.status).toBe(400);
});

test("changing the times of day clears options and busy times in dropped parts", async () => {
  const { path, view } = await planWithOptions();
  const [first] = datesIn(view.plan.windowStart, view.plan.windowEnd);
  const saved = await call("PUT", `${path}/registration`, bill, {
    attending: true,
    budgetCents: 3000,
    busy: [
      { date: first, part: "morning" },
      { date: first, part: "evening" },
    ],
    preferences: [],
  });
  expect(saved.status).toBe(200);
  const res = await call("PUT", path, nicky, {
    title: view.plan.title,
    areaId: view.plan.area.id,
    windowStart: view.plan.windowStart,
    windowEnd: view.plan.windowEnd,
    parts: ["evening"],
  });
  expect(res.status).toBe(200);
  const edited = (await res.json()) as PlanView;
  expect(edited.plan.parts).toEqual(["evening"]);
  expect(edited.options).toEqual([]);
  const bills = (await (await call("GET", path, bill)).json()) as PlanView;
  expect(bills.me.registration?.busy).toEqual([
    { date: first, part: "evening" },
  ]);
  const outside = await call("PUT", `${path}/registration`, bill, {
    attending: true,
    budgetCents: 3000,
    busy: [{ date: first, part: "morning" }],
    preferences: [],
  });
  expect(outside.status).toBe(400);
});

test("registering, voting, locking and generating on an ended plan are 409", async () => {
  const plan = await createPlan("today");
  await db.query(
    "update plans set window_start = window_start - 1, window_end = window_end - 1 where id = $1",
    [plan.id],
  );
  const path = `/api/circles/${circleId}/plans/${plan.id}`;
  const attempts: [string, string, string, unknown][] = [
    [
      "PUT",
      "registration",
      bill,
      { attending: true, budgetCents: 2000, busy: [], preferences: [] },
    ],
    ["PUT", "vote", bill, { optionId: randomUUID() }],
    [
      "POST",
      "lock",
      nicky,
      { optionId: randomUUID(), start: new Date().toISOString() },
    ],
    ["POST", "options", nicky, undefined],
  ];
  for (const [method, route, token, data] of attempts) {
    const res = await call(method, `${path}/${route}`, token, data);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This plan has ended" });
  }
  const view = (await (await call("GET", path, nicky)).json()) as PlanView;
  expect(view.plan.phase).toEqual({ kind: "ended" });
  const circle = (await (
    await call("GET", `/api/circles/${circleId}`, nicky)
  ).json()) as CircleView;
  expect(circle.plans.find((p) => p.id === plan.id)?.phase).toEqual({
    kind: "ended",
  });
});

test("saving the same answers again keeps the options fresh; a change makes them stale", async () => {
  const { path } = await planWithOptions();
  const same = await call(
    "PUT",
    `${path}/registration`,
    bill,
    attending(3000, "sushi"),
  );
  expect(same.status).toBe(200);
  expect(((await same.json()) as PlanView).plan.phase).toEqual({
    kind: "open",
    options: "fresh",
  });
  const changed = await call(
    "PUT",
    `${path}/registration`,
    bill,
    attending(2500, "sushi"),
  );
  expect(changed.status).toBe(200);
  expect(((await changed.json()) as PlanView).plan.phase).toEqual({
    kind: "open",
    options: "stale",
  });
});
