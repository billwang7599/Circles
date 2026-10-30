import {
  areaById,
  CreatePlan,
  datesIn,
  EditPlan,
  RegistrationInput,
  localDate,
  sameRegistration,
  type BusyPart,
  type MemberSummary,
  type OptionView,
  type Part,
  type PlanPhase,
  type PlanView,
  type PreferenceId,
} from "@circles/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { memberOf, type AppEnv } from "./auth.ts";
import { body } from "./body.ts";
import type { Db } from "./db.ts";
import { planPhase, type PhaseRow } from "./plan/phase.ts";

type PlanRow = PhaseRow & {
  id: string;
  circleId: string;
  circleName: string;
  title: string;
  windowStart: string;
  parts: Part[];
  initiatorId: string;
  initiatorName: string;
  lockedOptionId: string | null;
  lockedStart: Date | null;
  phase: PlanPhase;
};

// What planPhase needs to know about a plan's options, for queries over plans p.
export const optionFacts = `
  (select count(*) from options o where o.plan_id = p.id)::int as "optionCount",
  (select max((t->>'start')::timestamptz)
   from options o, jsonb_array_elements(o.times) t where o.plan_id = p.id) as "lastStart"`;

export async function loadPlan(
  db: Db,
  planId: string,
  circleId: string,
): Promise<PlanRow> {
  const [plan] = z.uuid().safeParse(planId).success
    ? await db.query<Omit<PlanRow, "phase">>(
        `select p.id, p.circle_id as "circleId", c.name as "circleName", p.title,
           p.area_id as "areaId", p.window_start::text as "windowStart",
           p.window_end::text as "windowEnd", p.parts, p.status, p.version,
           m.id as "initiatorId", m.name as "initiatorName",
           p.locked_option_id as "lockedOptionId", p.locked_start as "lockedStart",
           p.locked_end as "lockedEnd", p.options_version as "optionsVersion",
           ${optionFacts}
         from plans p
         join members m on m.id = p.initiator_id
         join circles c on c.id = p.circle_id
         where p.id = $1 and p.circle_id = $2`,
        [planId, circleId],
      )
    : [];
  if (!plan) throw new HTTPException(404, { message: "Plan not found" });
  return { ...plan, phase: planPhase(plan, new Date()) };
}

export function assertNotEnded(plan: PlanRow) {
  if (plan.phase.kind === "ended" || plan.phase.kind === "past")
    throw new HTTPException(409, { message: "This plan has ended" });
}

export function assertOpen(plan: PlanRow) {
  assertNotEnded(plan);
  if (plan.phase.kind !== "open")
    throw new HTTPException(409, { message: "Plan is locked" });
}

export async function planView(
  db: Db,
  plan: PlanRow,
  me: MemberSummary,
): Promise<PlanView> {
  const [members, [mine], options] = await Promise.all([
    db.query<PlanView["members"][number]>(
      `select m.id, m.name, a.color, r.member_id is not null as registered,
         coalesce(r.attending, false) as attending, v.option_id as "voteOptionId"
       from members m
       join accounts a on a.id = m.account_id
       left join registrations r on r.plan_id = $1 and r.member_id = m.id
       left join votes v on v.plan_id = $1 and v.member_id = m.id
       where m.circle_id = $2 order by m.joined_at`,
      [plan.id, plan.circleId],
    ),
    db.query<{
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
    ),
    db.query<OptionView>(
      `select o.id, o.rank, o.place, o.times, o.summary, o.unverified,
         (select count(*) from votes v where v.option_id = o.id)::int as votes
       from options o where o.plan_id = $1 order by o.rank`,
      [plan.id],
    ),
  ]);
  return {
    plan: {
      id: plan.id,
      title: plan.title,
      circle: { id: plan.circleId, name: plan.circleName },
      area: { id: plan.areaId, name: areaById(plan.areaId).name },
      windowStart: plan.windowStart,
      windowEnd: plan.windowEnd,
      parts: plan.parts,
      phase: plan.phase,
      initiator: { id: plan.initiatorId, name: plan.initiatorName },
      locked:
        plan.lockedOptionId && plan.lockedStart
          ? {
              optionId: plan.lockedOptionId,
              start: plan.lockedStart.toISOString(),
            }
          : undefined,
    },
    members,
    me: {
      id: me.id,
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
    options,
  };
}

// A plan can't start before today in its area, though one already under way
// keeps its start when edited.
function assertStartsAhead(input: CreatePlan, keep?: { windowStart: string }) {
  if (keep && input.windowStart === keep.windowStart) return;
  const today = localDate(new Date(), areaById(input.areaId).timezone);
  if (input.windowStart < today)
    throw new HTTPException(400, {
      message: "The plan can't start in the past",
    });
}

export function plans(db: Db) {
  const app = new Hono<AppEnv>();

  app.post("/circles/:circleId/plans", async (c) => {
    const circleId = c.req.param("circleId");
    const me = await memberOf(c, db, circleId);
    const input = await body(c, CreatePlan);
    assertStartsAhead(input);
    const { title, areaId, windowStart, windowEnd, parts } = input;
    const [{ id }] = await db.query<{ id: string }>(
      `insert into plans (circle_id, initiator_id, title, area_id, window_start, window_end, parts)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [circleId, me.id, title, areaId, windowStart, windowEnd, parts],
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

  app.put("/circles/:circleId/plans/:planId", async (c) => {
    const { circleId, planId } = c.req.param();
    const me = await memberOf(c, db, circleId);
    const input = await body(c, EditPlan);
    const plan = await loadPlan(db, planId, circleId);
    assertOpen(plan);
    if (plan.initiatorId !== me.id)
      throw new HTTPException(403, {
        message: "Only the initiator can edit this plan",
      });
    assertStartsAhead(input, plan);
    const moved =
      input.areaId !== plan.areaId ||
      input.windowStart !== plan.windowStart ||
      input.windowEnd !== plan.windowEnd ||
      input.parts.join() !== plan.parts.join();
    if (!moved && input.title === plan.title)
      return c.json((await planView(db, plan, me)) satisfies PlanView);
    await db.transaction(async (tx) => {
      const [updated] = await tx.query<{ id: string }>(
        `update plans set title = $2, area_id = $3, window_start = $4,
           window_end = $5, parts = $6, version = version + 1
         where id = $1 and status = 'open' returning id`,
        [
          plan.id,
          input.title,
          input.areaId,
          input.windowStart,
          input.windowEnd,
          input.parts,
        ],
      );
      if (!updated) throw new HTTPException(409, { message: "Plan is locked" });
      if (!moved) return;
      await tx.query("delete from options where plan_id = $1", [plan.id]);
      await tx.query(
        `update registrations r set busy = coalesce(
           (select jsonb_agg(b) from jsonb_array_elements(r.busy) b
            where (b->>'date')::date between $2::date and $3::date
              and b->>'part' = any($4)),
           '[]'::jsonb)
         where plan_id = $1`,
        [plan.id, input.windowStart, input.windowEnd, input.parts],
      );
    });
    const edited = await loadPlan(db, plan.id, circleId);
    return c.json((await planView(db, edited, me)) satisfies PlanView);
  });

  app.put("/circles/:circleId/plans/:planId/registration", async (c) => {
    const { circleId, planId } = c.req.param();
    const me = await memberOf(c, db, circleId);
    const input = await body(c, RegistrationInput);
    const plan = await loadPlan(db, planId, circleId);
    assertOpen(plan);
    const dates = new Set(datesIn(plan.windowStart, plan.windowEnd));
    if (input.busy.some((b) => !dates.has(b.date)))
      throw new HTTPException(400, {
        message: "Busy date outside the window",
      });
    if (input.busy.some((b) => !plan.parts.includes(b.part)))
      throw new HTTPException(400, {
        message: "Busy time outside the plan's times of day",
      });
    // Saving the same answers again changes nothing, so the options stay fresh.
    const [current] = await db.query<{
      attending: boolean;
      budgetCents: number | null;
      busy: BusyPart[];
      preferences: PreferenceId[];
    }>(
      `select attending, budget_cents as "budgetCents", busy, preferences
       from registrations where plan_id = $1 and member_id = $2`,
      [plan.id, me.id],
    );
    const previous = current && {
      ...current,
      budgetCents: current.budgetCents ?? undefined,
    };
    if (sameRegistration(input, previous))
      return c.json((await planView(db, plan, me)) satisfies PlanView);
    // Only answers the planner used, or will use, invalidate options: someone
    // who was never in and stays out changes nothing for the group.
    const affects = (previous?.attending ?? false) || input.attending;
    await db.transaction(async (tx) => {
      const [open] = await tx.query<{ version: number }>(
        `update plans set version = version + case when $2 then 1 else 0 end
         where id = $1 and status = 'open' returning version`,
        [plan.id, affects],
      );
      if (!open) throw new HTTPException(409, { message: "Plan is locked" });
      await tx.query(
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
        await tx.query(
          "update members set default_budget_cents = $2, preferences = $3 where id = $1",
          [me.id, input.budgetCents, input.preferences],
        );
      else
        await tx.query(
          "delete from votes where plan_id = $1 and member_id = $2",
          [plan.id, me.id],
        );
    });
    const saved = await loadPlan(db, plan.id, circleId);
    return c.json((await planView(db, saved, me)) satisfies PlanView);
  });

  app.delete("/circles/:circleId/plans/:planId", async (c) => {
    const { circleId, planId } = c.req.param();
    const me = await memberOf(c, db, circleId);
    const plan = await loadPlan(db, planId, circleId);
    if (plan.initiatorId !== me.id)
      throw new HTTPException(403, {
        message: "Only the initiator can delete this plan",
      });
    await db.query("delete from plans where id = $1", [plan.id]);
    return c.json({ ok: true });
  });

  return app;
}
