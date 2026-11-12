// Seeds a local database with a spread of events for one account: trips with
// itinerary options made, a night out still gathering answers, events friends
// organize that the account is invited to, and one that has ended. The model
// api/.env names sets up each event and writes the options, as the server
// does; without one the fakes do.
// Usage: npm run seed -w api [-- you@example.com]
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { addDays, datesIn, type Detail, type EventView } from "@circles/shared";
import { Pool } from "pg";
import { createApp } from "../src/app.ts";
import { devVerifier } from "../src/auth.ts";
import { pgDb } from "../src/db.ts";
import { migrate } from "../src/migrate.ts";
import { modelsFor } from "../src/plan/models.ts";

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
const app = createApp(db, {
  verifier: devVerifier,
  ...modelsFor({
    AWS_REGION: process.env.AWS_REGION ?? "ca-central-1",
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID ?? "",
    PLACES_MAX_REQUESTS: process.env.PLACES_MAX_REQUESTS,
    PLACES_BIAS: process.env.PLACES_BIAS,
  }),
});

// Whoever runs it, named after their email, as are the friends.
const me = process.argv[2] ?? "organizer@example.com";
const nameOf = (email: string) => {
  const local = email.split("@")[0] || "organizer";
  return local[0]!.toUpperCase() + local.slice(1, 40);
};
const today = new Date().toISOString().slice(0, 10);

// Someone's answers, as the invite page's form sends them: which days of
// the window (offsets from its start, inclusive), a budget, which option of
// every pick question, a note for the first open question. Only what the
// event's questions ask for is sent, so the shape fits whatever the model
// set up.
type Answers = {
  days?: [number, number][];
  budget?: number;
  picks?: number[];
  note?: string;
  // In, but has not got round to the questions.
  silent?: boolean;
};
type Reply = Answers & { name: string; in: boolean };

type Demo = {
  // A friend's email when the account seeded for is a guest, not the
  // organizer; it then RSVPs from the link and claims its answers.
  organizer?: string;
  description: string;
  // Days from today.
  window: [number, number];
  replies: Reply[];
  // The seeded account's own answers; left out, it has not answered.
  mine?: Answers;
  // Make itinerary options at this detail, as the organizer.
  detail?: Detail;
  // Moved into the past once seeded, for the Past tab.
  ended?: boolean;
};

// Newest first on Home, so the last ones here lead.
const demos: Demo[] = [
  {
    description: "Thanksgiving potluck at my place, everyone brings a dish",
    window: [1, 3],
    ended: true,
    replies: [
      { name: "Ben", in: true, picks: [0], note: "Bringing the turkey" },
      { name: "Chloe", in: true, picks: [1], note: "Pie and a salad" },
      { name: "Dana", in: true, picks: [0, 1] },
      { name: "Eli", in: true, picks: [1], note: "I'll do drinks" },
      { name: "Fatima", in: false },
    ],
    mine: { picks: [0], note: "Mains and the table" },
  },
  {
    description: "Blue Jays home opener with a tailgate in the lot before",
    window: [150, 150],
    replies: [
      {
        name: "Ben",
        in: true,
        days: [[0, 0]],
        picks: [0],
        note: "I'll bring the grill",
      },
      { name: "Chloe", in: true, silent: true },
    ],
    mine: { days: [[0, 0]], picks: [1] },
  },
  {
    description:
      "Reading week road trip to Chicago, four or five days, splitting gas and an Airbnb",
    window: [97, 103],
    detail: "parts",
    replies: [
      {
        name: "Ben",
        in: true,
        days: [[0, 4]],
        budget: 600,
        picks: [0, 2],
        note: "I can drive, four seats",
      },
      { name: "Chloe", in: true, days: [[1, 5]], budget: 450, picks: [1] },
      {
        name: "Dana",
        in: true,
        days: [[0, 6]],
        budget: 800,
        picks: [0],
        note: "Deep dish is non-negotiable",
      },
      { name: "Eli", in: true, days: [[0, 3]], picks: [2] },
      { name: "Fatima", in: true, days: [[2, 6]], budget: 500, picks: [1, 2] },
      {
        name: "Grace",
        in: true,
        days: [[0, 4]],
        picks: [0],
        note: "Vegetarian",
      },
      { name: "Hiro", in: true, days: [[1, 4]], budget: 700, picks: [0, 1] },
      { name: "Ivy", in: true, days: [[0, 6]], picks: [1] },
      {
        name: "Jun",
        in: true,
        days: [[0, 2]],
        budget: 400,
        picks: [2],
        note: "Can only do the first few days",
      },
      { name: "Kai", in: true, silent: true },
      { name: "Maya", in: true, days: [[0, 4]], budget: 650, picks: [0] },
      { name: "Lena", in: false },
    ],
    mine: { days: [[0, 4]], budget: 600, picks: [0] },
  },
  {
    organizer: "dana@example.com",
    description:
      "Housewarming at my new place in the Junction, Saturday afternoon into the evening",
    window: [10, 10],
    replies: [
      { name: "Ben", in: true, days: [[0, 0]], picks: [0] },
      {
        name: "Chloe",
        in: true,
        days: [[0, 0]],
        picks: [1],
        note: "Bringing a plant",
      },
    ],
    mine: { days: [[0, 0]], picks: [0], note: "I'll bring dessert" },
  },
  {
    organizer: "ben@example.com",
    description:
      "Weekend in Montréal for the Christmas markets, train or carpool",
    window: [30, 44],
    detail: "parts",
    replies: [
      {
        name: "Chloe",
        in: true,
        days: [
          [0, 2],
          [7, 9],
        ],
        budget: 400,
        picks: [0],
        note: "Train, I get carsick",
      },
      { name: "Dana", in: false },
      { name: "Eli", in: true, days: [[7, 9]], budget: 350, picks: [1] },
    ],
    mine: {
      days: [
        [0, 2],
        [7, 9],
      ],
      budget: 450,
      picks: [0],
    },
  },
  {
    organizer: "chloe@example.com",
    description: "Board game night at mine, bring snacks and a game",
    window: [5, 9],
    replies: [
      {
        name: "Ben",
        in: true,
        days: [[1, 2]],
        picks: [0, 1],
        note: "I have Catan and Codenames",
      },
      { name: "Dana", in: false },
    ],
    mine: { silent: true },
  },
  {
    description:
      "Ramen crawl on a weeknight, three spots between Koreatown and Chinatown",
    window: [3, 12],
    replies: [
      {
        name: "Ben",
        in: true,
        days: [
          [0, 1],
          [5, 6],
        ],
        picks: [0],
      },
      { name: "Dana", in: true, days: [[1, 3]], picks: [1], note: "No pork" },
      { name: "Eli", in: true, silent: true },
    ],
    mine: { days: [[0, 3]], picks: [0, 1] },
  },
  {
    description:
      "Sarah's surprise 30th, dinner then drinks downtown, we're chipping in for a gift",
    window: [24, 26],
    detail: "hours",
    replies: [
      {
        name: "Ben",
        in: true,
        days: [[0, 2]],
        budget: 150,
        picks: [0],
        note: "I'll handle the cake",
      },
      { name: "Chloe", in: true, days: [[0, 1]], budget: 120, picks: [1] },
      {
        name: "Dana",
        in: true,
        days: [[1, 2]],
        budget: 200,
        picks: [0, 1],
        note: "She loves karaoke",
      },
      { name: "Eli", in: true, days: [[0, 2]], budget: 100, picks: [1] },
      { name: "Fatima", in: true, days: [[1, 1]], budget: 150, picks: [0] },
      {
        name: "Grace",
        in: true,
        days: [[0, 2]],
        picks: [0],
        note: "I can get us a reservation",
      },
      { name: "Hiro", in: true, days: [[0, 2]], budget: 180, picks: [1] },
      { name: "Ivy", in: false },
      { name: "Jun", in: false },
    ],
    mine: { days: [[0, 2]], budget: 150, picks: [0] },
  },
  {
    description:
      "Cottage weekend on a lake within three hours of Toronto with the uni crew",
    window: [16, 45],
    detail: "parts",
    replies: [
      {
        name: "Ben",
        in: true,
        days: [
          [8, 10],
          [22, 24],
        ],
        budget: 300,
        picks: [0, 1],
        note: "I can drive, four seats",
      },
      { name: "Chloe", in: true, days: [[8, 10]], budget: 250, picks: [1] },
      {
        name: "Dana",
        in: true,
        days: [
          [1, 3],
          [8, 10],
        ],
        budget: 350,
        picks: [0],
        note: "Allergic to nuts",
      },
      { name: "Eli", in: true, silent: true },
      { name: "Fatima", in: false },
    ],
    mine: {
      days: [
        [8, 10],
        [22, 24],
      ],
      budget: 300,
      picks: [0],
    },
  },
  {
    description: "Friday climbing at the bouldering gym, then dinner nearby",
    window: [2, 23],
    replies: [],
  },
];

async function api<T>(
  email: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await app.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer dev:${email}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok)
    throw new Error(`${method} ${path}: ${json.error ?? res.status}`);
  return json;
}

// The invite page's form, as a browser sends it back: the RSVP sets the
// cookie, and the answers follow with it.
async function form(
  path: string,
  fields: Record<string, string | string[]>,
  cookie?: string,
) {
  const data = new URLSearchParams();
  for (const [name, value] of Object.entries(fields))
    for (const v of [value].flat()) data.append(name, v);
  const res = await app.request(path, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(cookie ? { cookie } : {}),
    },
    body: data.toString(),
  });
  if (res.status !== 303) throw new Error(`POST ${path}: ${res.status}`);
  return res.headers.get("set-cookie")?.split(";")[0] ?? cookie ?? "";
}

function fieldsOf(event: EventView["event"], answers: Answers) {
  const fields: Record<string, string | string[]> = { answers: "1" };
  const days = datesIn(event.windowStart, event.windowEnd);
  if (answers.days)
    fields.day = answers.days.flatMap(([from, to]) =>
      days.slice(from, Math.min(to, days.length - 1) + 1),
    );
  let noted = false;
  for (const question of event.questions) {
    if (question.kind === "budget" && answers.budget !== undefined)
      fields.budgetOther = String(answers.budget);
    if (question.kind === "choice" && answers.picks)
      fields[`q_${question.id}`] = [
        ...new Set(
          answers.picks.map(
            (i) => question.choices[i % question.choices.length]!.id,
          ),
        ),
      ];
    if (question.kind === "text" && answers.note && !noted) {
      fields[`q_${question.id}`] = answers.note;
      noted = true;
    }
  }
  return fields;
}

async function seed(demo: Demo) {
  const organizer = demo.organizer ?? me;
  // A friend who shares the account's name is the account: the invite page
  // would ask "same person?" instead of taking a second reply.
  const replies = demo.replies.filter(
    (r) => r.name.toLowerCase() !== nameOf(me).toLowerCase(),
  );
  const { event } = await api<EventView>(organizer, "POST", "/api/events", {
    description: demo.description,
    windowStart: addDays(today, demo.window[0]),
    windowEnd: addDays(today, demo.window[1]),
    timezone: "America/Toronto",
  });
  const path = new URL(event.url).pathname;
  for (const reply of replies) {
    const cookie = await form(path, {
      name: reply.name,
      attending: reply.in ? "in" : "out",
    });
    if (reply.in && !reply.silent)
      await form(path, fieldsOf(event, reply), cookie);
  }
  if (demo.mine) {
    let cookie: string;
    if (organizer === me) {
      // The organizer answers from the link the app opens for them.
      const { url } = await api<{ url: string }>(
        me,
        "POST",
        `/api/events/${event.id}/answers-link`,
        {},
      );
      const opened = await app.request(
        `${path}?g=${new URL(url).searchParams.get("g")}`,
      );
      cookie = opened.headers.get("set-cookie")?.split(";")[0] ?? "";
    } else {
      // A guest is in from the link like anyone, then the account takes
      // that response as its own, as opening the link in the app does.
      cookie = await form(path, { name: nameOf(me), attending: "in" });
      await api(me, "POST", `/api/invites/${path.split("/").pop()}/claim`, {
        token: cookie.slice(cookie.indexOf("=") + 1),
      });
    }
    if (!demo.mine.silent) await form(path, fieldsOf(event, demo.mine), cookie);
  }
  if (demo.detail)
    await api(organizer, "POST", `/api/events/${event.id}/itineraries`, {
      detail: demo.detail,
    });
  if (demo.ended)
    await db.query(
      `update events set window_start = $2, window_end = $3,
         created_at = now() - interval '40 days' where id = $1`,
      [event.id, addDays(today, -32), addDays(today, -30)],
    );
  const count = replies.length + (demo.mine && organizer !== me ? 1 : 0);
  const out = replies.filter((r) => !r.in).length;
  print(
    `${event.title}  ${path}  ${count - out + 1} in${out ? `, ${out} out` : ""}` +
      (organizer === me ? "" : `  (${nameOf(organizer)}'s)`),
  );
  return event;
}

const [seeded] = await db.query<{ slug: string }>(
  "select slug from events where description = $1",
  [demos[0]!.description],
);
if (seeded) {
  print("Already seeded; reset the database to seed again");
} else {
  for (const email of new Set([
    me,
    ...demos.flatMap((d) => (d.organizer ? [d.organizer] : [])),
  ]))
    await api(email, "PUT", "/api/me/name", { displayName: nameOf(email) });
  const events = [];
  for (const demo of demos) events.push([demo, await seed(demo)] as const);

  // The options are made after each request answers, one event at a time
  // on the model; the cards wait for their days, so the seed waits too.
  const making = events
    .filter(([demo]) => demo.detail)
    .map(([, event]) => event.id);
  if (making.length > 0) {
    print(`Making itinerary options for ${making.length} events...`);
    const deadline = Date.now() + 10 * 60_000;
    let pending = making.length;
    while (pending > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      [{ pending }] = await db.query<{ pending: number }>(
        `select count(*)::int as pending from events e
         where e.id = any($1::uuid[])
           and (e.itineraries_version is null or exists (
             select 1 from itineraries i
             where i.event_id = e.id and (i.body->>'daysPending')::boolean))`,
        [making],
      );
    }
    print(
      pending === 0
        ? "Options made"
        : `${pending} events still have no options; see the log above`,
    );
  }
}
print(`Signed in as ${me}, the app shows them all`);

await pool.end();
