import type {
  MembershipResponse,
  PlanView,
  PreferenceId,
  RegistrationInput,
} from "@circles/shared";
import { expect } from "vitest";
import { createApp } from "./app.ts";
import { testDb } from "./testDb.ts";

export const attending = (
  budgetCents = 3000,
  preference: PreferenceId = "ramen",
): RegistrationInput => ({
  attending: true,
  budgetCents,
  busy: [],
  preferences: [preference],
});

export async function testApp(deps: Parameters<typeof createApp>[1] = {}) {
  const db = await testDb();
  const app = createApp(db, deps);

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

  const createCircle = (name: string, memberName: string) =>
    membership("/api/circles", { name, memberName });

  async function circleWith(...names: string[]) {
    const [first, ...rest] = names;
    const created = await createCircle("Dinner club", first);
    const tokens = [created.token];
    for (const name of rest) {
      const joined = await membership("/api/circles/join", {
        code: created.circle.joinCode,
        name,
      });
      tokens.push(joined.token);
    }
    return { circleId: created.circle.id, tokens };
  }

  async function createPlan(circleId: string, token: string, when = "week") {
    const res = await call("POST", `/api/circles/${circleId}/plans`, token, {
      title: "Ramen",
      areaId: "uw",
      when,
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as PlanView).plan;
  }

  async function register(
    path: string,
    token: string,
    input: RegistrationInput,
  ) {
    const res = await call("PUT", `${path}/registration`, token, input);
    expect(res.status).toBe(200);
    return (await res.json()) as PlanView;
  }

  async function planWithOptions(circleId: string, tokens: string[]) {
    const plan = await createPlan(circleId, tokens[0]);
    const path = `/api/circles/${circleId}/plans/${plan.id}`;
    for (const [i, token] of tokens.entries())
      await register(path, token, attending(3000, i % 2 ? "sushi" : "ramen"));
    const res = await call("POST", `${path}/options`, tokens[0]);
    expect(res.status).toBe(201);
    return { path, view: (await res.json()) as PlanView };
  }

  return {
    app,
    db,
    call,
    membership,
    createCircle,
    circleWith,
    createPlan,
    register,
    planWithOptions,
  };
}

export type TestApp = Awaited<ReturnType<typeof testApp>>;
