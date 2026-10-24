import {
  areaById,
  CreatePlan,
  datesIn,
  RegistrationInput,
  windowFor,
  type AreaId,
  type BusyPart,
  type MemberSummary,
  type PlanStatus,
  type PlanView,
  type PreferenceId,
} from "@circles/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { memberOf, type AppEnv } from "./auth.ts";
import { body } from "./body.ts";
import type { Db } from "./db.ts";

type PlanRow = {
  id: string;
  circleId: string;
  title: string;
  areaId: AreaId;
  windowStart: string;
  windowEnd: string;
  status: PlanStatus;
  version: number;
  initiatorId: string;
  initiatorName: string;
};

async function loadPlan(
  db: Db,
  planId: string,
  circleId: string,
): Promise<PlanRow> {
  const [plan] = z.uuid().safeParse(planId).success
    ? await db.query<PlanRow>(
        `select p.id, p.circle_id as "circleId", p.title, p.area_id as "areaId",
           p.window_start::text as "windowStart", p.window_end::text as "windowEnd",
           p.status, p.version, m.id as "initiatorId", m.name as "initiatorName"
         from plans p join members m on m.id = p.initiator_id
         where p.id = $1 and p.circle_id = $2`,
        [planId, circleId],
      )
    : [];
  if (!plan) throw new HTTPException(404, { message: "Plan not found" });
  return plan;
}

export async function planView(
  db: Db,
  plan: PlanRow,
  me: MemberSummary,
): Promise<PlanView> {
  const members = await db.query<PlanView["members"][number]>(
    `select m.id, m.name, r.member_id is not null as registered,
       coalesce(r.attending, false) as attending, null::uuid as "voteOptionId"
     from members m
     left join registrations r on r.plan_id = $1 and r.member_id = m.id
     where m.circle_id = $2 order by m.joined_at`,
    [plan.id, plan.circleId],
  );
  const [mine] = await db.query<{
    defaultBudgetCents: number | null;
    defaultPreferences: PreferenceId[];
    attending: boolean | null;
    budgetCents: number | null;
    busy: BusyPart[] | null;
    preferences: PreferenceId[] | null;
  }>(
    `select m.default_budget_cents as "defaultBudgetCents",
       m.preferences as "defaultPreferences", r.attending,
       r.budget_cents as "budgetCents", r.busy, r.preferences
     from members m
     left join registrations r on r.plan_id = $1 and r.member_id = m.id
     where m.id = $2`,
    [plan.id, me.id],
  );
  return {
    plan: {
      id: plan.id,
      title: plan.title,
      area: { id: plan.areaId, name: areaById(plan.areaId).name },
      windowStart: plan.windowStart,
      windowEnd: plan.windowEnd,
      status: plan.status,
      version: plan.version,
      initiator: { id: plan.initiatorId, name: plan.initiatorName },
    },
    members,
    me: {
      registration:
        mine.attending === null
          ? undefined
          : {
              attending: mine.attending,
              budgetCents: mine.budgetCents ?? undefined,
              busy: mine.busy ?? [],
              preferences: mine.preferences ?? [],
            },
      defaults: {
        budgetCents: mine.defaultBudgetCents ?? undefined,
        preferences: mine.defaultPreferences,
      },
    },
    options: [],
    optionsStale: false,
  };
}

export function plans(db: Db) {
  const app = new Hono<AppEnv>();

  app.post("/circles/:circleId/plans", async (c) => {
    const circleId = c.req.param("circleId");
    const me = await memberOf(c, db, circleId);
    const { title, areaId, when } = await body(c, CreatePlan);
    const { windowStart, windowEnd } = windowFor(
      when,
      areaById(areaId).timezone,
      new Date(),
    );
    const [{ id }] = await db.query<{ id: string }>(
      `insert into plans (circle_id, initiator_id, title, area_id, window_start, window_end)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [circleId, me.id, title, areaId, windowStart, windowEnd],
    );
    const plan = await loadPlan(db, id, circleId);
    return c.json((await planView(db, plan, me)) satisfies PlanView, 201);
  });

  app.get("/circles/:circleId/plans/:planId", async (c) => {
    const { circleId, planId } = c.req.param();
    const me = await memberOf(c, db, circleId);
    const plan = await loadPlan(db, planId, circleId);
    return c.json((await planView(db, plan, me)) satisfies PlanView);
  });

  app.put("/circles/:circleId/plans/:planId/registration", async (c) => {
    const { circleId, planId } = c.req.param();
    const me = await memberOf(c, db, circleId);
    const input = await body(c, RegistrationInput);
    const plan = await loadPlan(db, planId, circleId);
    const dates = new Set(datesIn(plan.windowStart, plan.windowEnd));
    if (input.busy.some((b) => !dates.has(b.date)))
      throw new HTTPException(400, {
        message: "Busy date outside the window",
      });
    const [bumped] = await db.query<{ version: number }>(
      "update plans set version = version + 1 where id = $1 and status = 'open' returning version",
      [plan.id],
    );
    if (!bumped) throw new HTTPException(409, { message: "Plan is locked" });
    await db.query(
      `insert into registrations (plan_id, member_id, attending, budget_cents, busy, preferences)
       values ($1, $2, $3, $4, $5::jsonb, $6)
       on conflict (plan_id, member_id) do update set
         attending = excluded.attending, budget_cents = excluded.budget_cents,
         busy = excluded.busy, preferences = excluded.preferences, updated_at = now()`,
      [
        plan.id,
        me.id,
        input.attending,
        input.budgetCents ?? null,
        JSON.stringify(input.busy),
        input.preferences,
      ],
    );
    if (input.attending)
      await db.query(
        "update members set default_budget_cents = $2, preferences = $3 where id = $1",
        [me.id, input.budgetCents, input.preferences],
      );
    const view = await planView(db, { ...plan, version: bumped.version }, me);
    return c.json(view satisfies PlanView);
  });

  return app;
}
