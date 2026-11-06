import type {
  CircleView,
  Defaults,
  Lock,
  Me,
  NextPlan,
  PlanView,
} from "@circles/shared";
import { beforeAll, expect, test, vi } from "vitest";
import type { Db } from "./db.ts";
import { newToken, testApp, type TestApp } from "./testApp.ts";

let call: TestApp["call"];
let createCircle: TestApp["createCircle"];
let circleWith: TestApp["circleWith"];
let named: TestApp["named"];
let register: TestApp["register"];
let createPlan: TestApp["createPlan"];
let planWithOptions: TestApp["planWithOptions"];
let db: Db;

beforeAll(async () => {
  ({
    call,
    createCircle,
    circleWith,
    createPlan,
    named,
    planWithOptions,
    register,
    db,
  } = await testApp());
});

const get = (path: string, token?: string) => call("GET", path, token);
const post = (path: string, data: unknown) =>
  call("POST", path, newToken(), data);

const defaults: Defaults = {
  budget: "under30",
  availability: [{ day: "sat", part: "evening" }],
  likes: ["food", "lateNight"],
  dislikes: ["coffee"],
};

test("two members of a circle can share a name", async () => {
  const { circle } = await createCircle("Dinner club", "Nicky");
  const token = await named("nicky");
  const res = await call("POST", "/api/circles/join", token, {
    code: circle.joinCode,
  });
  expect(res.status).toBe(201);
});

test("creating or joining a circle needs a name first", async () => {
  const { circle } = await createCircle("Dinner club", "Nicky");
  for (const [path, data] of [
    ["/api/circles", { name: "Lunch club" }],
    ["/api/circles/join", { code: circle.joinCode }],
  ] as const) {
    const res = await post(path, data);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Add your name first" });
  }
});

test("a new account has no name, and /me shows the one it picks", async () => {
  const token = newToken();
  expect(
    ((await (await get("/api/me", token)).json()) as Me).displayName,
  ).toBeNull();
  await named("  Nicky  ", token);
  const me = (await (await get("/api/me", token)).json()) as Me;
  expect(me.displayName).toBe("Nicky");
  expect(me.color).toEqual(expect.any(String));
});

test("a rename reaches every circle the account is in", async () => {
  const first = await createCircle("Dinner club", "Nicky");
  const second = await call("POST", "/api/circles", first.token, {
    name: "Lunch club",
  });
  expect(second.status).toBe(201);
  const renamed = await call("PUT", "/api/me/name", first.token, {
    displayName: "Nick",
  });
  expect(renamed.status).toBe(200);
  const me = (await (await get("/api/me", first.token)).json()) as Me;
  expect(me.circles.map((circle) => circle.memberName)).toEqual([
    "Nick",
    "Nick",
  ]);
  const view = (await (
    await get(`/api/circles/${first.circle.id}`, first.token)
  ).json()) as CircleView;
  expect(view.members.map((member) => member.name)).toEqual(["Nick"]);
});

test.each(["", "   ", "x".repeat(41)])(
  "a name of %j is refused",
  async (name) => {
    const res = await call("PUT", "/api/me/name", newToken(), {
      displayName: name,
    });
    expect(res.status).toBe(400);
  },
);

test("a circle keeps the emoji it was made with", async () => {
  const token = await named("Nicky");
  const res = await call("POST", "/api/circles", token, {
    name: "Flat 3B",
    emoji: "🏠",
  });
  expect(res.status).toBe(201);
  const me = (await (await get("/api/me", token)).json()) as Me;
  expect(me.circles).toMatchObject([{ name: "Flat 3B", emoji: "🏠" }]);
});

test("an emoji outside the set is refused", async () => {
  const res = await call("POST", "/api/circles", await named("Nicky"), {
    name: "Flat 3B",
    emoji: "🦄",
  });
  expect(res.status).toBe(400);
});

test("defaults start empty and come back as saved", async () => {
  const token = newToken();
  expect(await (await get("/api/me/defaults", token)).json()).toEqual({
    budget: null,
    availability: [],
    likes: [],
    dislikes: [],
  });
  const saved = await call("PUT", "/api/me/defaults", token, defaults);
  expect(saved.status).toBe(200);
  expect(await (await get("/api/me/defaults", token)).json()).toEqual(defaults);
});

test.each([
  ["a fourth like", { likes: ["food", "music", "games", "chill"] }],
  ["a tag in both lists", { likes: ["coffee"] }],
  ["an unknown rung", { budget: "under5" }],
])("defaults with %s are refused", async (_, change) => {
  const res = await call("PUT", "/api/me/defaults", newToken(), {
    ...defaults,
    ...change,
  });
  expect(res.status).toBe(400);
});

test("a plan offers the account's defaults over what the circle remembers", async () => {
  const {
    circleId,
    tokens: [nicky],
  } = await circleWith("Nicky", "Bill");
  const plan = await createPlan(circleId, nicky);
  const path = `/api/circles/${circleId}/plans/${plan.id}`;
  await register(path, nicky, {
    attending: true,
    budgetCents: 5000,
    busy: [],
    preferences: ["ramen"],
  });
  const before = (await (await get(path, nicky)).json()) as PlanView;
  expect(before.me.defaults).toEqual({
    budgetCents: 5000,
    preferences: ["ramen"],
    availability: [],
  });
  await call("PUT", "/api/me/defaults", nicky, defaults);
  const after = (await (await get(path, nicky)).json()) as PlanView;
  expect(after.me.defaults).toEqual({
    budgetCents: 3000,
    preferences: ["ramen"],
    availability: defaults.availability,
  });
});

test("saving a registration leaves the account's defaults alone", async () => {
  const {
    circleId,
    tokens: [nicky],
  } = await circleWith("Nicky", "Bill");
  await call("PUT", "/api/me/defaults", nicky, defaults);
  const plan = await createPlan(circleId, nicky);
  await register(`/api/circles/${circleId}/plans/${plan.id}`, nicky, {
    attending: true,
    budgetCents: 5000,
    busy: [],
    preferences: ["ramen"],
  });
  expect(await (await get("/api/me/defaults", nicky)).json()).toEqual(defaults);
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
