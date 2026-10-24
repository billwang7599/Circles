import { createHash, randomBytes } from "node:crypto";
import type { MemberSummary } from "@circles/shared";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Db } from "./db.ts";

export type AppEnv = { Variables: { accountId?: string } };

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

async function bearer(c: Context<AppEnv>, db: Db) {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;
  const [row] = await db.query<{ id: string }>(
    "select id from accounts where token_hash = $1",
    [hash(header.slice(7))],
  );
  if (!row) throw new HTTPException(401, { message: "Unknown token" });
  c.set("accountId", row.id);
  return row.id;
}

export async function account(c: Context<AppEnv>, db: Db): Promise<string> {
  const id = await bearer(c, db);
  if (!id) throw new HTTPException(401, { message: "Not signed in" });
  return id;
}

export async function accountOrNew(
  c: Context<AppEnv>,
  db: Db,
): Promise<{ accountId: string; token?: string }> {
  const existing = await bearer(c, db);
  if (existing) return { accountId: existing };
  const token = randomBytes(32).toString("base64url");
  const [row] = await db.query<{ id: string }>(
    "insert into accounts (token_hash) values ($1) returning id",
    [hash(token)],
  );
  c.set("accountId", row.id);
  return { accountId: row.id, token };
}

export async function memberOf(
  c: Context<AppEnv>,
  db: Db,
  circleId: string,
): Promise<MemberSummary> {
  const accountId = await account(c, db);
  const [member] = z.uuid().safeParse(circleId).success
    ? await db.query<MemberSummary>(
        "select id, name from members where account_id = $1 and circle_id = $2",
        [accountId, circleId],
      )
    : [];
  if (!member)
    throw new HTTPException(403, { message: "Not a member of this circle" });
  return member;
}
