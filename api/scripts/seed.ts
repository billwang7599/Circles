import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type {
  AreaId,
  MembershipResponse,
  Part,
  PlanView,
  PreferenceId,
  RegistrationInput,
} from "@circles/shared";
import { Pool } from "pg";
import { createApp } from "../src/app.ts";
import { pgDb } from "../src/db.ts";
import { migrate } from "../src/migrate.ts";

type Member = {
  name: string;
  budgetCents?: number;
  busy?: [dayOffset: number, part: Part][];
  preferences?: PreferenceId[];
};

type Circle = {
  name: string;
  code: string;
  plan: { title: string; areaId: AreaId };
  members: Member[];
};

const circles: Circle[] = [
  {
    name: "Roommates",
    code: "FSQWWV",
    plan: { title: "Dinner Friday", areaId: "uptown" },
    members: [
      {
        name: "Maya",
        budgetCents: 4000,
        busy: [[1, "morning"]],
        preferences: ["ramen", "bar"],
      },
      {
        name: "Jordan",
        budgetCents: 3000,
        busy: [[2, "evening"]],
        preferences: ["korean", "pizza"],
      },
      { name: "Priya" },
    ],
  },
  {
    name: "SE Friends",
    code: "YQLJVS",
    plan: { title: "Coffee before lecture", areaId: "uw" },
    members: [
      { name: "Elena", budgetCents: 1500, preferences: ["coffee"] },
      {
        name: "Marcus",
        budgetCents: 2000,
        busy: [[3, "afternoon"]],
        preferences: ["coffee", "dessert"],
      },
      { name: "Sam", budgetCents: 1200, preferences: ["bubbleTea"] },
    ],
  },
];

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const url =
  process.env.DATABASE_URL ??
  "postgres://circles:circles@localhost:5432/circles";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  process.stderr.write("The seed only runs against a local database\n");
  process.exit(1);
}
const print = (line: string) => process.stdout.write(`${line}\n`);

const pool = new Pool({ connectionString: url });
// Migrations run on one connection so their transaction and lock hold.
const client = await pool.connect();
await migrate(pgDb(client));
client.release();
const db = pgDb(pool);
const app = createApp(db);

async function request<T>(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<T> {
  const res = await app.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok)
    throw new Error(`${method} ${path}: ${json.error ?? res.status}`);
  return json;
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const seeded = await db.query<{ name: string }>(
  "select name from circles where join_code = any($1)",
  [circles.map((c) => c.code)],
);
if (seeded.length > 0) {
  print(`Already seeded: ${seeded.map((c) => c.name).join(", ")}`);
  await pool.end();
  process.exit(0);
}

function tokenOf(membership: MembershipResponse) {
  if (!membership.token) throw new Error("No token returned");
  return membership.token;
}

for (const circle of circles) {
  const [owner, ...others] = circle.members;
  const created = await request<MembershipResponse>(
    "POST",
    "/api/circles",
    undefined,
    { name: circle.name, memberName: owner.name },
  );
  await db.query("update circles set join_code = $1 where id = $2", [
    circle.code,
    created.circle.id,
  ]);
  const tokens = new Map([[owner.name, tokenOf(created)]]);
  for (const member of others) {
    const joined = await request<MembershipResponse>(
      "POST",
      "/api/circles/join",
      undefined,
      { code: circle.code, name: member.name },
    );
    tokens.set(member.name, tokenOf(joined));
  }

  const plan = await request<PlanView>(
    "POST",
    `/api/circles/${created.circle.id}/plans`,
    tokens.get(owner.name),
    { ...circle.plan, when: "week" },
  );
  for (const member of circle.members) {
    if (member.budgetCents === undefined) continue;
    const input: RegistrationInput = {
      attending: true,
      budgetCents: member.budgetCents,
      busy: (member.busy ?? []).map(([offset, part]) => ({
        date: shiftDate(plan.plan.windowStart, offset),
        part,
      })),
      preferences: member.preferences ?? [],
    };
    await request(
      "PUT",
      `/api/circles/${created.circle.id}/plans/${plan.plan.id}/registration`,
      tokens.get(member.name),
      input,
    );
  }

  print(`${circle.name}  ${circle.code}`);
  for (const [name, token] of tokens) print(`  ${name.padEnd(8)}${token}`);
}

await pool.end();
