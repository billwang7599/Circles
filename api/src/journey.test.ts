import type { Me, PlanView } from "@circles/shared";
import { expect, test } from "vitest";
import { attending, testApp } from "./testApp.ts";

// One plan from start to finish, watched through what /me asks of each member.
test("a plan's whole life, as each member's next move", async () => {
  const t = await testApp();
  const { call, db } = t;
  const { circleId, tokens } = await t.circleWith("Nicky", "Bill", "Dana");
  const [nicky, bill, dana] = tokens;
  const nexts = () =>
    Promise.all(
      tokens.map(async (token) => {
        const me = (await (await call("GET", "/api/me", token)).json()) as Me;
        return me.circles[0].next?.kind ?? null;
      }),
    );
  expect(await nexts()).toEqual([null, null, null]);

  const plan = await t.createPlan(circleId, nicky);
  const path = `/api/circles/${circleId}/plans/${plan.id}`;
  const view = async (token = nicky) =>
    (await (await call("GET", path, token)).json()) as PlanView;
  const phase = async (token?: string) => (await view(token)).plan.phase;
  expect(plan.phase).toEqual({ kind: "open", options: "none" });
  expect(await nexts()).toEqual(["inputs", "inputs", "inputs"]);

  await t.register(path, nicky, attending(3000, "ramen"));
  expect(await nexts()).toEqual(["open", "inputs", "inputs"]);
  const alone = await call("POST", `${path}/options`, nicky);
  expect(alone.status).toBe(422);
  expect(await alone.json()).toEqual({
    error: "Need at least two people in",
    reason: "need_two",
  });

  // Anyone can get the first options once two people are in.
  await t.register(path, bill, attending(3000, "sushi"));
  const first = await call("POST", `${path}/options`, bill);
  expect(first.status).toBe(201);
  const options = ((await first.json()) as PlanView).options;
  expect(options).toHaveLength(3);
  expect(await phase()).toEqual({ kind: "open", options: "fresh" });
  expect(await nexts()).toEqual(["vote", "vote", "inputs"]);

  // Dana was never in, so her no changes nothing for the group.
  await t.register(path, dana, { attending: false, busy: [], preferences: [] });
  expect(await phase()).toEqual({ kind: "open", options: "fresh" });
  expect(await nexts()).toEqual(["vote", "vote", "open"]);

  const vote = (token: string, optionId: string) =>
    call("PUT", `${path}/vote`, token, { optionId });
  expect((await vote(nicky, options[0].id)).status).toBe(200);
  expect((await vote(bill, options[1].id)).status).toBe(200);
  expect((await view()).options.map((o) => o.votes)).toEqual([1, 1, 0]);
  expect(await nexts()).toEqual(["open", "open", "open"]);

  const lock = { optionId: options[0].id, start: options[0].times[0].start };
  expect((await call("POST", `${path}/lock`, bill, lock)).status).toBe(403);
  expect((await call("POST", `${path}/lock`, nicky, lock)).status).toBe(200);
  expect(await nexts()).toEqual(["locked", "locked", "locked"]);

  // Unlocking keeps the votes; a changed answer then makes the options stale,
  // and only the initiator can renew them, which clears the votes.
  expect((await call("DELETE", `${path}/lock`, nicky)).status).toBe(200);
  expect(await nexts()).toEqual(["open", "open", "open"]);
  await t.register(path, bill, attending(3000, "ramen"));
  expect(await phase()).toEqual({ kind: "open", options: "stale" });
  expect((await call("POST", `${path}/lock`, nicky, lock)).status).toBe(409);
  expect((await call("POST", `${path}/options`, bill)).status).toBe(403);
  const renewed = await call("POST", `${path}/options`, nicky);
  expect(renewed.status).toBe(201);
  const fresh = ((await renewed.json()) as PlanView).options;
  expect(fresh.map((o) => o.votes)).toEqual([0, 0, 0]);
  expect(await nexts()).toEqual(["vote", "vote", "open"]);

  // Once the locked evening is over the plan is past and asks nothing of anyone.
  const relock = { optionId: fresh[0].id, start: fresh[0].times[0].start };
  expect((await call("POST", `${path}/lock`, nicky, relock)).status).toBe(200);
  await db.query(
    "update plans set locked_end = now() - interval '1 minute' where id = $1",
    [plan.id],
  );
  expect(await phase(dana)).toEqual({ kind: "past" });
  expect(await nexts()).toEqual([null, null, null]);

  // A plan whose window passes without a lock has ended and asks nothing either.
  const ended = await t.createPlan(circleId, nicky, "today");
  expect(await nexts()).toEqual(["inputs", "inputs", "inputs"]);
  await db.query(
    "update plans set window_start = window_start - 1, window_end = window_end - 1 where id = $1",
    [ended.id],
  );
  expect(await nexts()).toEqual([null, null, null]);

  expect((await call("DELETE", path, nicky)).status).toBe(200);
  expect((await call("GET", path, dana)).status).toBe(404);
}, 20_000);
