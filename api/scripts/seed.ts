// Seeds a local database with one organizer, one ski trip and three responses.
// Usage: npm run seed -w api [-- you@example.com]
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  addDays,
  datesIn,
  presetWindow,
  type EventView,
  type Question,
} from "@circles/shared";
import { Pool } from "pg";
import { createApp } from "../src/app.ts";
import { devVerifier } from "../src/auth.ts";
import { pgDb } from "../src/db.ts";
import { migrate } from "../src/migrate.ts";

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
const app = createApp(db, { verifier: devVerifier });

const organizer = process.argv[2] ?? "organizer@example.com";
const description = "Ski trip with Ben and Chloe, somewhere we can drive to";

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await app.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer dev:${organizer}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok)
    throw new Error(`${method} ${path}: ${json.error ?? res.status}`);
  return json;
}

const [seeded] = await db.query<{ slug: string }>(
  "select slug from events where description = $1",
  [description],
);
if (seeded) {
  print(`Already seeded: /i/${seeded.slug}`);
} else {
  // Whoever runs it organizes, named after their email.
  const local = organizer.split("@")[0] || "organizer";
  await request("PUT", "/api/me/name", {
    displayName: local[0]!.toUpperCase() + local.slice(1, 40),
  });
  const today = new Date().toISOString().slice(0, 10);
  const { event } = await request<EventView>("POST", "/api/events", {
    description,
    ...presetWindow("nextTwoMonths", today),
    timezone: "America/Toronto",
  });
  const ofKind = <K extends Question["kind"]>(kind: K) =>
    event.questions.find((q) => q.kind === kind) as
      Extract<Question, { kind: K }> | undefined;
  const choice = ofKind("choice");
  const text = ofKind("text");
  const start = event.windowStart;
  const invitePath = new URL(event.url).pathname;

  // The invite page's form, as a browser sends it back: the RSVP sets the
  // cookie, and the answers follow with it.
  async function form(
    fields: Record<string, string | string[]>,
    cookie?: string,
  ) {
    const data = new URLSearchParams();
    for (const [name, value] of Object.entries(fields))
      for (const v of [value].flat()) data.append(name, v);
    const res = await app.request(invitePath, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...(cookie ? { cookie } : {}),
      },
      body: data.toString(),
    });
    if (res.status !== 303)
      throw new Error(`POST ${invitePath}: ${res.status}`);
    return res.headers.get("set-cookie")?.split(";")[0] ?? "";
  }

  const days = (from: number, to: number) =>
    datesIn(addDays(start, from), addDays(start, to));
  const fields = (
    ranges: [number, number][],
    budget: string,
    picks: number[],
    note: string,
  ) => ({
    answers: "1",
    day: ranges.flatMap(([from, to]) => days(from, to)),
    budgetOther: budget,
    ...(choice && {
      [`q_${choice.id}`]: picks.map((i) => choice.choices[i]!.id),
    }),
    ...(text && note ? { [`q_${text.id}`]: note } : {}),
  });

  const responses: [
    string,
    boolean,
    Record<string, string | string[]> | null,
  ][] = [
    [
      "Ben",
      true,
      fields(
        [
          [10, 13],
          [24, 27],
        ],
        "600",
        [0, 1],
        "I can drive",
      ),
    ],
    ["Chloe", true, fields([[11, 13]], "1000", [1], "")],
    ["Dana", false, null],
  ];
  for (const [name, attending, answers] of responses) {
    const cookie = await form({ name, attending: attending ? "in" : "out" });
    if (answers) await form(answers, cookie);
  }
  print(`${event.title}  ${invitePath}`);
  for (const [name, attending] of responses)
    print(`  ${name.padEnd(8)}${attending ? "in" : "out"}`);
}
print(`Organizer: ${organizer}`);

await pool.end();
