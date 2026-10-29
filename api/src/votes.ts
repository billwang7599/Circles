import {
  Lock,
  Vote,
  type Interval,
  type PlanStatus,
  type PlanView,
} from "@circles/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { memberOf, type AppEnv } from "./auth.ts";
import { body } from "./body.ts";
import type { Db } from "./db.ts";
import { assertNotEnded, loadPlan, planView } from "./plans.ts";

export function votes(db: Db) {
  const app = new Hono<AppEnv>();

  app.put("/circles/:circleId/plans/:planId/vote", async (c) => {
    const { circleId, planId } = c.req.param();
    const me = await memberOf(c, db, circleId);
    const { optionId } = await body(c, Vote);
    const plan = await loadPlan(db, planId, circleId);
    assertNotEnded(plan);
    const [registration] = await db.query<{ attending: boolean }>(
      "select attending from registrations where plan_id = $1 and member_id = $2",
      [plan.id, me.id],
    );
    if (!registration?.attending)
      throw new HTTPException(403, {
        message: "Only people who are in can vote",
      });
    const [voted] = await db.query<{ optionId: string }>(
      `insert into votes (plan_id, member_id, option_id)
       select $1::uuid, $2::uuid, $3::uuid
       where exists (
         select 1 from options o join plans p on p.id = o.plan_id
         where o.id = $3 and o.plan_id = $1 and p.status = 'open'
           and p.options_version = p.version
       ) and exists (
         select 1 from registrations r
         where r.plan_id = $1 and r.member_id = $2 and r.attending
       )
       on conflict (plan_id, member_id) do update
         set option_id = excluded.option_id, updated_at = now()
       returning option_id as "optionId"`,
      [plan.id, me.id, optionId],
    );
    if (!voted)
      throw new HTTPException(409, { message: "Options changed, pick again" });
    return c.json((await planView(db, plan, me)) satisfies PlanView);
  });

  app.post("/circles/:circleId/plans/:planId/lock", async (c) => {
    const { circleId, planId } = c.req.param();
    const me = await memberOf(c, db, circleId);
    const { optionId, start } = await body(c, Lock);
    const plan = await loadPlan(db, planId, circleId);
    assertNotEnded(plan);
    if (plan.initiatorId !== me.id)
      throw new HTTPException(403, {
        message: "Only the initiator can lock in",
      });
    await db.transaction(async (tx) => {
      const [option] = await tx.query<{ times: Interval[] }>(
        "select times from options where id = $1 and plan_id = $2",
        [optionId, plan.id],
      );
      const slot = option?.times.find(
        (t) => Date.parse(t.start) === Date.parse(start),
      );
      if (slot) {
        if (Date.parse(slot.start) < Date.now())
          throw new HTTPException(422, { message: "That time has passed" });
        if (plan.optionsVersion !== plan.version)
          throw new HTTPException(409, {
            message: "Inputs changed, get new options first",
          });
      }
      // The version guard makes the lock fail if anyone's inputs landed after
      // the staleness check above.
      const [locked] = slot
        ? await tx.query<{ id: string }>(
            `update plans set status = 'locked', locked_option_id = $2,
               locked_start = $3, locked_end = $4
             where id = $1 and status = 'open' and initiator_id = $5
               and version = $6
             returning id`,
            [plan.id, optionId, slot.start, slot.end, me.id, plan.version],
          )
        : [];
      if (locked) return;
      const [current] = await tx.query<{ status: PlanStatus; version: number }>(
        "select status, version from plans where id = $1",
        [plan.id],
      );
      if (!current) throw new HTTPException(404, { message: "Plan not found" });
      if (current.status === "locked")
        throw new HTTPException(409, { message: "Already locked in" });
      if (!option)
        throw new HTTPException(409, {
          message: "Options changed, pick again",
        });
      if (current.version !== plan.version)
        throw new HTTPException(409, {
          message: "Inputs changed, get new options first",
        });
      throw new HTTPException(422, {
        message: "Pick one of the option's times",
      });
    });
    const locked = await loadPlan(db, plan.id, circleId);
    return c.json((await planView(db, locked, me)) satisfies PlanView);
  });

  // Back to open: votes and options stay, so the initiator can pick again.
  app.delete("/circles/:circleId/plans/:planId/lock", async (c) => {
    const { circleId, planId } = c.req.param();
    const me = await memberOf(c, db, circleId);
    const plan = await loadPlan(db, planId, circleId);
    assertNotEnded(plan);
    if (plan.initiatorId !== me.id)
      throw new HTTPException(403, {
        message: "Only the initiator can unlock",
      });
    const [unlocked] = await db.query<{ id: string }>(
      `update plans set status = 'open', locked_option_id = null,
         locked_start = null, locked_end = null
       where id = $1 and status = 'locked' returning id`,
      [plan.id],
    );
    if (!unlocked) throw new HTTPException(409, { message: "Not locked in" });
    const open = await loadPlan(db, plan.id, circleId);
    return c.json((await planView(db, open, me)) satisfies PlanView);
  });

  return app;
}
