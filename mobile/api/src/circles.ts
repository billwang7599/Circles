import { randomInt } from "node:crypto";
import {
  CreateCircle,
  JoinCircle,
  type CircleSummary,
  type CircleView,
  type Me,
  type MemberSummary,
  type MembershipResponse,
  type PlanSummary,
} from "@circles/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { account, accountOrNew, memberOf, type AppEnv } from "./auth.ts";
import { body } from "./body.ts";
import type { Db } from "./db.ts";

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
    throw err;
  }
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
    const rows = await db.query<Me["circles"][number]>(
      `select c.id, c.name, m.id as "memberId", m.name as "memberName"
       from members m join circles c on c.id = m.circle_id
       where m.account_id = $1 order by m.joined_at`,
      [accountId],
    );
    return c.json({ circles: rows } satisfies Me);
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
      joinedAt: Date;
    }>(
      'select id, name, joined_at as "joinedAt" from members where circle_id = $1 order by joined_at',
      [circleId],
    );
    const plans = await db.query<PlanSummary>(
      `select id, title, status, window_start::text as "windowStart",
         window_end::text as "windowEnd", null::text as "lockedStart"
       from plans where circle_id = $1 order by created_at desc`,
      [circleId],
    );
    return c.json({
      circle,
      me,
      members: members.map((m) => ({
        ...m,
        joinedAt: m.joinedAt.toISOString(),
      })),
      plans,
    } satisfies CircleView);
  });

  return app;
}
