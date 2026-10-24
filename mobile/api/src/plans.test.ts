import {
  datesIn,
  type MembershipResponse,
  type PlanView,
  type RegistrationInput,
} from "@circles/shared";
import { beforeAll, expect, test } from "vitest";
import { createApp } from "./app.ts";
import { testDb } from "./testDb.ts";

let app: ReturnType<typeof createApp>;
let circleId: string;
let nicky: string;
let bill: string;

function call(method: string, path: string, token?: string, data?: unknown) {
  return app.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

async function membership(path: string, data: unknown) {
  const res = await call("POST", path, undefined, data);
  expect(res.status).toBe(201);
  return (await res.json()) as MembershipResponse & { token: string };
}

async function createPlan(when: string) {
  const res = await call("POST", `/api/circles/${circleId}/plans`, nicky, {
    title: "Ramen",
    areaId: "uw",
    when,
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as PlanView).plan;
}

beforeAll(async () => {
  app = createApp(await testDb());
  const created = await membership("/api/circles", {
    name: "Dinner club",
    memberName: "Nicky",
  });
  circleId = created.circle.id;
  nicky = created.token;
  bill = (
    await membership("/api/circles/join", {
      code: created.circle.joinCode,
      name: "Bill",
    })
  ).token;
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
