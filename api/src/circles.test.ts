import type { CircleView, Lock, Me, NextPlan, PlanView } from "@circles/shared";
import { beforeAll, expect, test, vi } from "vitest";
import type { Db } from "./db.ts";
import { testApp, type TestApp } from "./testApp.ts";

let call: TestApp["call"];
let createCircle: TestApp["createCircle"];
let circleWith: TestApp["circleWith"];
let createPlan: TestApp["createPlan"];
let planWithOptions: TestApp["planWithOptions"];
let db: Db;

beforeAll(async () => {
  ({ call, createCircle, circleWith, createPlan, planWithOptions, db } =
    await testApp());
});

const get = (path: string, token?: string) => call("GET", path, token);
const post = (path: string, data: unknown) =>
  call("POST", path, undefined, data);

test("joining with a name someone in the circle already uses is 409", async () => {
  const { circle } = await createCircle("Dinner club", "Nicky");
  const res = await post("/api/circles/join", {
    code: circle.joinCode,
    name: "nicky",
  });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({
    error: "Someone in this circle already uses that name",
  });
});

test("no token is 401", async () => {
  const res = await get("/api/me");
  expect(res.status).toBe(401);
});

test("a token from another circle is 403 on the circle view", async () => {
  const mine = await createCircle("Mine", "Nicky");
  const theirs = await createCircle("Theirs", "Bill");
  const res = await get(`/api/circles/${mine.circle.id}`, theirs.token);
  expect(res.status).toBe(403);
});

test("the request log never contains the token", async () => {
  const write = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(() => true);
  const { token } = await createCircle("Logged", "Nicky");
  const res = await get("/api/me", token);
  const lines = write.mock.calls.map(([chunk]) => String(chunk));
  write.mockRestore();
  expect(res.status).toBe(200);
  expect(lines.some((line) => line.includes('"path":"/api/me"'))).toBe(true);
  expect(lines.some((line) => line.includes(token))).toBe(false);
});

test("the circle view carries the caller's own registration and vote", async () => {
  const {
    circleId,
    tokens: [nicky, bill, cara],
  } = await circleWith("Nicky", "Bill", "Cara");
  const { path, view } = await planWithOptions(circleId, [nicky, bill]);
  const voted = await call("PUT", `${path}/vote`, nicky, {
    optionId: view.options[0].id,
  });
  expect(voted.status).toBe(200);
  for (const [token, mine] of [
    [nicky, { registered: true, attending: true, voted: true }],
    [cara, { registered: false, attending: false, voted: false }],
  ] as const) {
    const res = await get(`/api/circles/${circleId}`, token);
    expect(res.status).toBe(200);
    const { plans } = (await res.json()) as CircleView;
    expect(plans).toMatchObject([
      { id: view.plan.id, ...mine, phase: { kind: "open", options: "fresh" } },
    ]);
  }
});

type Arranged = { id: string; title: string } | null;

test.each<{
  kind: NextPlan["kind"] | null;
  arrange: (circleId: string, tokens: string[]) => Promise<Arranged>;
}>([
  {
    kind: "inputs",
    arrange: (circleId, [nicky]) => createPlan(circleId, nicky),
  },
  {
    kind: "vote",
    arrange: async (circleId, tokens) =>
      (await planWithOptions(circleId, tokens)).view.plan,
  },
  {
    kind: "locked",
    arrange: async (circleId, tokens) => {
      const { path, view } = await planWithOptions(circleId, tokens);
      const lock: Lock = {
        optionId: view.options[0].id,
        start: view.options[0].times[0].start,
      };
      const res = await call("POST", `${path}/lock`, tokens[0], lock);
      expect(res.status).toBe(200);
      return view.plan;
    },
  },
  {
    kind: "open",
    arrange: async (circleId, tokens) => {
      const { path, view } = await planWithOptions(circleId, tokens);
      const res = await call("PUT", `${path}/vote`, tokens[0], {
        optionId: view.options[0].id,
      });
      expect(res.status).toBe(200);
      return view.plan;
    },
  },
  {
    kind: null,
    arrange: async (circleId, [nicky]) => {
      const { id } = await createPlan(circleId, nicky, "today");
      await db.query(
        "update plans set window_start = window_start - 1, window_end = window_end - 1 where id = $1",
        [id],
      );
      return null;
    },
  },
])("/me next is $kind", async ({ kind, arrange }) => {
  const { circleId, tokens } = await circleWith("Nicky", "Bill");
  const plan = await arrange(circleId, tokens);
  const res = await get("/api/me", tokens[0]);
  expect(res.status).toBe(200);
  expect((await res.json()) as Me).toMatchObject({
    circles: [
      {
        id: circleId,
        next: plan && { id: plan.id, title: plan.title, kind },
      },
    ],
  });
});

test("an attending member leaving marks the plan's options stale", async () => {
  const {
    circleId,
    tokens: [nicky, bill],
  } = await circleWith("Nicky", "Bill", "Cara");
  const { path, view } = await planWithOptions(circleId, [nicky, bill]);
  expect(view.plan.phase).toEqual({ kind: "open", options: "fresh" });
  const left = await call(
    "DELETE",
    `/api/circles/${circleId}/members/me`,
    bill,
  );
  expect(left.status).toBe(200);
  const after = (await (await get(path, nicky)).json()) as PlanView;
  expect(after.plan.phase).toEqual({ kind: "open", options: "stale" });
  expect(after.members.map((m) => m.name)).toEqual(["Nicky", "Cara"]);
});

test("leaving hands the leaver's plans to the longest-standing member; the last to leave removes the circle", async () => {
  const {
    circleId,
    tokens: [nicky, bill],
  } = await circleWith("Nicky", "Bill");
  const plan = await createPlan(circleId, nicky);
  const leavePath = `/api/circles/${circleId}/members/me`;
  const left = await call("DELETE", leavePath, nicky);
  expect(left.status).toBe(200);
  expect(((await (await get("/api/me", nicky)).json()) as Me).circles).toEqual(
    [],
  );
  const circle = (await (
    await get(`/api/circles/${circleId}`, bill)
  ).json()) as CircleView;
  expect(circle.members.map((m) => m.name)).toEqual(["Bill"]);
  const view = (await (
    await get(`/api/circles/${circleId}/plans/${plan.id}`, bill)
  ).json()) as PlanView;
  expect(view.plan.initiator.id).toBe(view.me.id);
  const last = await call("DELETE", leavePath, bill);
  expect(last.status).toBe(200);
  expect((await get(`/api/circles/${circleId}`, bill)).status).toBe(403);
  expect(
    await db.query("select 1 from circles where id = $1", [circleId]),
  ).toEqual([]);
});
