import { randomInt } from "node:crypto";
import { AVATAR_COLORS, Email, type MemberSummary } from "@circles/shared";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { FetchError, JwtBaseError } from "aws-jwt-verify/error";
import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Db } from "./db.ts";

export type AppEnv = { Variables: { accountId?: string } };

// sub resolves undefined for a token it refuses and rejects when it can't tell.
export type Verifier = {
  sub(token: string): Promise<string | undefined>;
  email(token: string): Promise<string>;
};

export const devVerifier: Verifier = {
  async sub(token) {
    const email = token.match(/^dev:(.+)$/)?.[1];
    return email && Email.safeParse(email).success ? token : undefined;
  },
  async email(token) {
    return token.slice("dev:".length);
  },
};

export function verifierFor({
  NODE_ENV,
  COGNITO_USER_POOL_ID,
  COGNITO_CLIENT_ID,
}: Record<
  "NODE_ENV" | "COGNITO_USER_POOL_ID" | "COGNITO_CLIENT_ID",
  string
>): Verifier {
  const settings = { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID };
  const missing = Object.entries(settings)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (
    missing.length === Object.keys(settings).length &&
    NODE_ENV !== "production"
  )
    return devVerifier;
  if (missing.length > 0)
    throw new Error(`Set ${missing.join(", ")} to sign people in`);

  const jwt = CognitoJwtVerifier.create({
    userPoolId: COGNITO_USER_POOL_ID,
    clientId: COGNITO_CLIENT_ID,
    tokenUse: "access",
  });
  const region = COGNITO_USER_POOL_ID.split("_")[0];
  return {
    async sub(token) {
      try {
        return (await jwt.verify(token)).sub;
      } catch (err) {
        if (err instanceof JwtBaseError && !(err instanceof FetchError))
          return undefined;
        throw err;
      }
    },
    // The app signs in through the user-pool API, whose tokens userInfo refuses (no openid scope).
    async email(token) {
      const res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
        method: "POST",
        headers: {
          "content-type": "application/x-amz-json-1.1",
          "x-amz-target": "AWSCognitoIdentityProviderService.GetUser",
        },
        body: JSON.stringify({ AccessToken: token }),
      });
      if (!res.ok) throw new Error(`GetUser answered ${res.status}`);
      const { UserAttributes } = z
        .object({
          UserAttributes: z.array(
            z.object({ Name: z.string(), Value: z.string() }),
          ),
        })
        .parse(await res.json());
      return Email.parse(UserAttributes.find((a) => a.Name === "email")?.Value);
    },
  };
}

export function authenticate(
  db: Db,
  verifier: Verifier,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = c.req.header("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new HTTPException(401, { message: "Not signed in" });
    const sub = await verifier.sub(token);
    if (!sub) throw new HTTPException(401, { message: "Invalid token" });
    let [row] = await db.query<{ id: string }>(
      "select id from accounts where sub = $1",
      [sub],
    );
    if (!row) {
      // A concurrent first request may insert the same sub; both get its id.
      [row] = await db.query<{ id: string }>(
        `insert into accounts (sub, email, color) values ($1, $2, $3)
         on conflict (sub) do update set email = excluded.email returning id`,
        [
          sub,
          await verifier.email(token),
          AVATAR_COLORS[randomInt(AVATAR_COLORS.length)],
        ],
      );
    }
    c.set("accountId", row.id);
    await next();
  };
}

export function account(c: Context<AppEnv>): string {
  const id = c.get("accountId");
  if (!id) throw new HTTPException(401, { message: "Not signed in" });
  return id;
}

export async function memberOf(
  c: Context<AppEnv>,
  db: Db,
  circleId: string,
): Promise<MemberSummary> {
  const accountId = account(c);
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
