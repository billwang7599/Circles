import { randomInt } from "node:crypto";
import {
  type AvatarColor,
  CreateCircle,
  JoinCircle,
  nextMove,
  type CircleSummary,
  type CircleView,
  type Me,
  type MemberSummary,
  type MembershipResponse,
  type NextPlan,
  type PlanPhase,
} from "@circles/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { account, accountOrNew, memberOf, type AppEnv } from "./auth.ts";
import { body } from "./body.ts";
import type { Db } from "./db.ts";
import { planPhase, type PhaseRow } from "./plan/phase.ts";
import { optionFacts } from "./plans.ts";

const codeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function joinCode() {
  return Array.from(
    { length: 6 },
    () => codeAlphabet[randomInt(codeAlphabet.length)],
  ).join("");
}

async function createCircle(db: Db, name: string): Promise<CircleSummary> {
  for (;;) {
    const [circle] = await db.query<CircleSummary>(
      `insert into circles (name, join_code) values ($1, $2)
       on conflict (join_code) do nothing
       returning id, name, join_code as "joinCode"`,
      [name, joinCode()],
    );
    if (circle) return circle;
  }
}

const conflicts: Record<string, string> = {
  members_one_per_account: "You're already in this circle",
  members_unique_name: "Someone in this circle already uses that name",
};

async function addMember(
  db: Db,
  accountId: string,
  circleId: string,
  name: string,
): Promise<MemberSummary> {
  try {
    const [member] = await db.query<MemberSummary>(
      "insert into members (account_id, circle_id, name) values ($1, $2, $3) returning id, name",
      [accountId, circleId, name],
    );
    return member;
  } catch (err) {
    const constraint =
      typeof err === "object" && err !== null && "constraint" in err
        ? err.constraint
        : undefined;
    const message =
      typeof constraint === "string" ? conflicts[constraint] : undefined;
    if (message) throw new HTTPException(409, { message });
    // The circle was removed while this join was in flight.
    if (constraint === "members_circle_id_fkey")
      throw new HTTPException(404, { message: "No circle has that code" });
    throw err;
  }
}

type PlanListRow = PhaseRow & {
  circleId: string;
  id: string;
  title: string;
  windowStart: string;
  lockedStart: Date | null;
  registered: boolean;
  attending: boolean;
  voted: boolean;
  phase: PlanPhase;
};

// A plan as one member sees it, for queries over plans p joined with that
// member's registration r and vote v.
const planColumns = `p.circle_id as "circleId", p.id, p.title, p.status,
  p.area_id as "areaId", p.window_start::text as "windowStart",
  p.window_end::text as "windowEnd", p.locked_start as "lockedStart",
  p.locked_end as "lockedEnd", p.version, p.options_version as "optionsVersion",
  r.member_id is not null as registered, coalesce(r.attending, false) as attending,
  v.member_id is not null as voted, ${optionFacts}`;

function nextPlan(plans: PlanListRow[]): NextPlan | null {
  const inputs = plans.find((p) => nextMove(p) === "inputs");
  const vote = plans.find((p) => nextMove(p) === "vote");
  const locked = plans
    .filter((p) => p.phase.kind === "locked")
    .sort((a, b) => Number(a.lockedStart) - Number(b.lockedStart));
  const plan =
    inputs ?? vote ?? locked[0] ?? plans.find((p) => p.phase.kind === "open");
  if (!plan) return null;
  return {
    id: plan.id,
    title: plan.title,
    kind: plan === inputs ? "inputs" : plan === vote ? "vote" : plan.status,
  };
}

export function circles(db: Db) {
  const app = new Hono<AppEnv>();

  app.post("/circles", async (c) => {
    const { name, memberName } = await body(c, CreateCircle);
    const { accountId, token } = await accountOrNew(c, db);
    const circle = await createCircle(db, name);
    const member = await addMember(db, accountId, circle.id, memberName);
    return c.json({ token, circle, member } satisfies MembershipResponse, 201);
  });

  app.post("/circles/join", async (c) => {
    const { code, name } = await body(c, JoinCircle);
    const [circle] = await db.query<CircleSummary>(
      'select id, name, join_code as "joinCode" from circles where join_code = $1',
      [code],
    );
    if (!circle)
      throw new HTTPException(404, { message: "No circle has that code" });
    const { accountId, token } = await accountOrNew(c, db);
    const member = await addMember(db, accountId, circle.id, name);
    return c.json({ token, circle, member } satisfies MembershipResponse, 201);
  });

  app.get("/me", async (c) => {
    const accountId = await account(c, db);
    const circles = await db.query<Omit<Me["circles"][number], "next">>(
      `select c.id, c.name, m.id as "memberId", m.name as "memberName"
       from members m join circles c on c.id = m.circle_id
       where m.account_id = $1 order by m.joined_at`,
      [accountId],
    );
    const now = new Date();
    // The where clause is a coarse cut on the database clock; planPhase decides.
    const plans = (
      await db.query<Omit<PlanListRow, "phase">>(
        `select ${planColumns}
         from members m
         join plans p on p.circle_id = m.circle_id
         left join registrations r on r.plan_id = p.id and r.member_id = m.id
         left join votes v on v.plan_id = p.id and v.member_id = m.id
         where m.account_id = $1 and (p.status = 'open' or p.locked_end > now())
         order by p.window_start, p.created_at`,
        [accountId],
      )
    ).map((p) => ({ ...p, phase: planPhase(p, now) }));
    return c.json({
      circles: circles.map((circle) => ({
        ...circle,
        next: nextPlan(plans.filter((p) => p.circleId === circle.id)),
      })),
    } satisfies Me);
  });

  app.get("/circles/:circleId", async (c) => {
    const circleId = c.req.param("circleId");
    const me = await memberOf(c, db, circleId);
    const [circle] = await db.query<CircleSummary>(
      'select id, name, join_code as "joinCode" from circles where id = $1',
      [circleId],
    );
    const members = await db.query<{
      id: string;
      name: string;
      color: AvatarColor;
      joinedAt: Date;
    }>(
      `select m.id, m.name, a.color, m.joined_at as "joinedAt"
       from members m join accounts a on a.id = m.account_id
       where m.circle_id = $1 order by m.joined_at`,
      [circleId],
    );
    const now = new Date();
    const plans = await db.query<Omit<PlanListRow, "phase">>(
      `select ${planColumns}
       from plans p
       left join registrations r on r.plan_id = p.id and r.member_id = $2
       left join votes v on v.plan_id = p.id and v.member_id = $2
       where p.circle_id = $1 order by p.created_at desc`,
      [circleId, me.id],
    );
    return c.json({
      circle,
      me,
      members: members.map((m) => ({
        ...m,
        joinedAt: m.joinedAt.toISOString(),
      })),
      plans: plans.map((p) => ({
        id: p.id,
        title: p.title,
        areaId: p.areaId,
        windowStart: p.windowStart,
        windowEnd: p.windowEnd,
        lockedStart: p.lockedStart?.toISOString() ?? null,
        phase: planPhase(p, now),
        registered: p.registered,
        attending: p.attending,
        voted: p.voted,
      })),
    } satisfies CircleView);
  });

  app.delete("/circles/:circleId/members/me", async (c) => {
    const circleId = c.req.param("circleId");
    const me = await memberOf(c, db, circleId);
    await db.transaction(async (tx) => {
      // One departure or arrival at a time per circle: a join in flight holds a
      // share lock on this row, so the roster below is final.
      await tx.query("select 1 from circles where id = $1 for update", [
        circleId,
      ]);
      const [heir] = await tx.query<{ id: string }>(
        `select id from members where circle_id = $1 and id <> $2
         order by joined_at limit 1`,
        [circleId, me.id],
      );
      if (!heir) {
        await tx.query("delete from circles where id = $1", [circleId]);
        return;
      }
      await tx.query(
        "update plans set initiator_id = $2 where circle_id = $1 and initiator_id = $3",
        [circleId, heir.id, me.id],
      );
      // Plans counted on the leaver's inputs: their options are stale now,
      // locked ones too, so an unlock asks for a refresh.
      await tx.query(
        `update plans p set version = version + 1
         where p.circle_id = $1 and exists (
           select 1 from registrations r
           where r.plan_id = p.id and r.member_id = $2 and r.attending
         )`,
        [circleId, me.id],
      );
      await tx.query("delete from members where id = $1", [me.id]);
    });
    return c.json({ ok: true });
  });

  return app;
}
