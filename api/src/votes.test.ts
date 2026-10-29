import { randomUUID } from "node:crypto";
import type { CircleView, Lock, PlanView } from "@circles/shared";
import { beforeAll, expect, test } from "vitest";
import type { Db } from "./db.ts";
import { attending, testApp, type TestApp } from "./testApp.ts";

let call: TestApp["call"];
let db: Db;
let circleId: string;
const tokens = { nicky: "", bill: "", cara: "" };
let open: { path: string; view: PlanView };
let planWithOptions: () => ReturnType<TestApp["planWithOptions"]>;
let t: TestApp;

const lockBody = (view: PlanView, patch: Partial<Lock> = {}): Lock => ({
  optionId: view.options[0].id,
  start: view.options[0].times[0].start,
  ...patch,
});

beforeAll(async () => {
  t = await testApp();
  ({ call, db } = t);
  const circle = await t.circleWith("Nicky", "Bill", "Cara");
  circleId = circle.circleId;
  [tokens.nicky, tokens.bill, tokens.cara] = circle.tokens;
  planWithOptions = () =>
    t.planWithOptions(circleId, [tokens.nicky, tokens.bill]);
  open = await planWithOptions();
});

test.each<{
  name: string;
  by: keyof typeof tokens;
  patch: (view: PlanView) => Partial<Lock>;
  status: number;
  error: string;
}>([
  {
    name: "by someone other than the initiator",
    by: "bill",
    patch: () => ({}),
    status: 403,
    error: "Only the initiator can lock in",
  },
  {
    name: "with a time the option does not offer",
    by: "nicky",
    patch: (view) => ({
      start: new Date(
        Date.parse(view.options[0].times[0].start) + 15 * 60_000,
      ).toISOString(),
    }),
    status: 422,
    error: "Pick one of the option's times",
  },
  {
    name: "with an option that is gone",
    by: "nicky",
    patch: () => ({ optionId: randomUUID() }),
    status: 409,
    error: "Options changed, pick again",
  },
])("lock in $name is $status", async ({ by, patch, status, error }) => {
  const res = await call(
    "POST",
    `${open.path}/lock`,
    tokens[by],
    lockBody(open.view, patch(open.view)),
  );
  expect(res.status).toBe(status);
  expect(await res.json()).toEqual({ error });
});

test("a lock while options are stale is 409 until new options are made", async () => {
  const { path, view } = await planWithOptions();
  const changed = await call(
    "PUT",
    `${path}/registration`,
    tokens.bill,
    attending(3000, "ramen"),
  );
  expect(changed.status).toBe(200);
  expect(((await changed.json()) as PlanView).plan.phase).toEqual({
    kind: "open",
    options: "stale",
  });
  const res = await call("POST", `${path}/lock`, tokens.nicky, lockBody(view));
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({
    error: "Inputs changed, get new options first",
  });
  const fresh = await call("POST", `${path}/options`, tokens.nicky);
  expect(fresh.status).toBe(201);
  const after = (await fresh.json()) as PlanView;
  const locked = await call(
    "POST",
    `${path}/lock`,
    tokens.nicky,
    lockBody(after),
  );
  expect(locked.status).toBe(200);
});

test("a slot that has already started cannot be locked", async () => {
  const { path, view } = await planWithOptions();
  const start = new Date(Date.now() - 3_600_000).toISOString();
  const end = new Date(Date.now() + 3_600_000).toISOString();
  await db.query("update options set times = $2::jsonb where plan_id = $1", [
    view.plan.id,
    JSON.stringify([{ start, end }]),
  ]);
  const res = await call("POST", `${path}/lock`, tokens.nicky, {
    optionId: view.options[0].id,
    start,
  });
  expect(res.status).toBe(422);
  expect(await res.json()).toEqual({ error: "That time has passed" });
  const after = (await (
    await call("GET", path, tokens.nicky)
  ).json()) as PlanView;
  expect(after.plan.phase).toEqual({ kind: "open", options: "stale" });
});

test("a vote from someone who can't make it is 403", async () => {
  const { path, view } = await planWithOptions();
  const declined = await call("PUT", `${path}/registration`, tokens.bill, {
    attending: false,
    busy: [],
    preferences: [],
  });
  expect(declined.status).toBe(200);
  const res = await call("PUT", `${path}/vote`, tokens.bill, {
    optionId: view.options[0].id,
  });
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({
    error: "Only people who are in can vote",
  });
});

test("a vote shows on the member and counts on the option", async () => {
  const { path, view } = await planWithOptions();
  const [first] = view.options;
  const res = await call("PUT", `${path}/vote`, tokens.bill, {
    optionId: first.id,
  });
  expect(res.status).toBe(200);
  const after = (await res.json()) as PlanView;
  expect(after.members.map((m) => [m.name, m.voteOptionId])).toEqual([
    ["Nicky", null],
    ["Bill", first.id],
    ["Cara", null],
  ]);
  expect(after.options.map((o) => o.votes)).toEqual([1, 0, 0]);
});

test("regenerating replaces the options and clears every vote", async () => {
  const { path, view } = await planWithOptions();
  const [first] = view.options;
  const voted = await call("PUT", `${path}/vote`, tokens.bill, {
    optionId: first.id,
  });
  expect(voted.status).toBe(200);
  const regenerated = await call("POST", `${path}/options`, tokens.nicky);
  expect(regenerated.status).toBe(201);
  const after = (await regenerated.json()) as PlanView;
  expect(after.options.map((o) => o.id)).not.toContain(first.id);
  expect(after.options.map((o) => o.votes)).toEqual([0, 0, 0]);
  expect(after.members.map((m) => m.voteOptionId)).toEqual([null, null, null]);
  const stale = await call("PUT", `${path}/vote`, tokens.bill, {
    optionId: first.id,
  });
  expect(stale.status).toBe(409);
  expect(await stale.json()).toEqual({ error: "Options changed, pick again" });
});

test("the initiator locks in once; locking, voting, registering and generating are then 409", async () => {
  const { path, view } = await planWithOptions();
  const lock = lockBody(view);
  const res = await call("POST", `${path}/lock`, tokens.nicky, lock);
  expect(res.status).toBe(200);
  const locked = (await res.json()) as PlanView;
  expect(locked.plan).toMatchObject({
    phase: { kind: "locked" },
    locked: { optionId: lock.optionId, start: lock.start },
  });
  const circle = (await (
    await call("GET", `/api/circles/${circleId}`, tokens.nicky)
  ).json()) as CircleView;
  expect(circle.plans.find((p) => p.id === locked.plan.id)).toMatchObject({
    phase: { kind: "locked" },
    lockedStart: lock.start,
  });

  const refused: [string, string, string, unknown, string][] = [
    ["POST", "lock", tokens.nicky, lock, "Already locked in"],
    [
      "PUT",
      "vote",
      tokens.bill,
      { optionId: lock.optionId },
      "Options changed, pick again",
    ],
    ["PUT", "registration", tokens.bill, attending(), "Plan is locked"],
    ["POST", "options", tokens.nicky, undefined, "Plan is locked"],
  ];
  for (const [method, route, token, data, error] of refused) {
    const r = await call(method, `${path}/${route}`, token, data);
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error });
  }
});

test("the initiator unlocks a locked plan, keeping votes, and can lock in again or delete it", async () => {
  const { path, view } = await planWithOptions();
  const lock = lockBody(view);
  const voted = await call("PUT", `${path}/vote`, tokens.bill, {
    optionId: lock.optionId,
  });
  expect(voted.status).toBe(200);
  expect((await call("POST", `${path}/lock`, tokens.nicky, lock)).status).toBe(
    200,
  );
  const refused = await call("DELETE", `${path}/lock`, tokens.bill);
  expect(refused.status).toBe(403);
  expect(await refused.json()).toEqual({
    error: "Only the initiator can unlock",
  });
  const res = await call("DELETE", `${path}/lock`, tokens.nicky);
  expect(res.status).toBe(200);
  const open = (await res.json()) as PlanView;
  expect(open.plan.phase).toEqual({ kind: "open", options: "fresh" });
  expect(open.plan.locked).toBeUndefined();
  expect(open.options.map((o) => o.votes)).toEqual([1, 0, 0]);
  const again = await call("DELETE", `${path}/lock`, tokens.nicky);
  expect(again.status).toBe(409);
  expect(await again.json()).toEqual({ error: "Not locked in" });
  expect((await call("POST", `${path}/lock`, tokens.nicky, lock)).status).toBe(
    200,
  );
  const deleted = await call("DELETE", path, tokens.nicky);
  expect(deleted.status).toBe(200);
  expect((await call("GET", path, tokens.nicky)).status).toBe(404);
});

test('someone who was never in saying "Can\'t make it" keeps the options fresh', async () => {
  const { path } = await planWithOptions();
  const res = await call("PUT", `${path}/registration`, tokens.cara, {
    attending: false,
    busy: [],
    preferences: [],
  });
  expect(res.status).toBe(200);
  expect(((await res.json()) as PlanView).plan.phase).toEqual({
    kind: "open",
    options: "fresh",
  });
});

test('saying "Can\'t make it" after voting removes the vote', async () => {
  const { path, view } = await planWithOptions();
  const voted = await call("PUT", `${path}/vote`, tokens.bill, {
    optionId: view.options[0].id,
  });
  expect(voted.status).toBe(200);
  const declined = await call("PUT", `${path}/registration`, tokens.bill, {
    attending: false,
    busy: [],
    preferences: [],
  });
  expect(declined.status).toBe(200);
  const after = (await declined.json()) as PlanView;
  expect(after.members.find((m) => m.name === "Bill")?.voteOptionId).toBeNull();
  expect(after.options.map((o) => o.votes)).toEqual([0, 0, 0]);
});

test("a locked plan is past once its slot ends, not when it starts", async () => {
  const { path, view } = await planWithOptions();
  const res = await call("POST", `${path}/lock`, tokens.nicky, lockBody(view));
  expect(res.status).toBe(200);
  const planId = view.plan.id;
  const phases = async () => {
    const plan = (await (
      await call("GET", path, tokens.nicky)
    ).json()) as PlanView;
    const circle = (await (
      await call("GET", `/api/circles/${circleId}`, tokens.nicky)
    ).json()) as CircleView;
    return [
      plan.plan.phase.kind,
      circle.plans.find((p) => p.id === planId)?.phase.kind,
    ];
  };
  await db.query(
    `update plans set locked_start = now() - interval '1 hour',
       locked_end = now() + interval '1 hour' where id = $1`,
    [planId],
  );
  expect(await phases()).toEqual(["locked", "locked"]);
  await db.query(
    "update plans set locked_end = now() - interval '1 minute' where id = $1",
    [planId],
  );
  expect(await phases()).toEqual(["past", "past"]);
  const unlock = await call("DELETE", `${path}/lock`, tokens.nicky);
  expect(unlock.status).toBe(409);
  expect(await unlock.json()).toEqual({ error: "This plan has ended" });
});

test("a member leaving a locked plan leaves its options stale once unlocked", async () => {
  const circle = await t.circleWith("Ana", "Ben", "Cy");
  const [ana, ben] = circle.tokens;
  const { path, view } = await t.planWithOptions(circle.circleId, [ana, ben]);
  expect((await call("POST", `${path}/lock`, ana, lockBody(view))).status).toBe(
    200,
  );
  const left = await call(
    "DELETE",
    `/api/circles/${circle.circleId}/members/me`,
    ben,
  );
  expect(left.status).toBe(200);
  const res = await call("DELETE", `${path}/lock`, ana);
  expect(res.status).toBe(200);
  expect(((await res.json()) as PlanView).plan.phase).toEqual({
    kind: "open",
    options: "stale",
  });
});
