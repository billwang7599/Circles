import { randomInt } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  answerLines,
  CreateEvent,
  localDate,
  EditEvent,
  ReadDates,
  UpdateName,
  type AvatarColor,
  type DateWindow,
  type EventSummary,
  type EventView,
  type Me,
  type Question,
} from "@circles/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { account, type AppEnv } from "./auth.ts";
import { body } from "./body.ts";
import type { Db, Tx } from "./db.ts";
import {
  requireEvent,
  responseColumns,
  type EventRow,
  type ResponseRow,
} from "./eventRow.ts";
import { originOf, type InviteOptions } from "./invites.ts";
import { loadItineraries } from "./itineraries.ts";
import { readDates, type DatesModel } from "./plan/dates.ts";
import { setupEvent, type SetupModel } from "./plan/setup.ts";

// The name an account organizes and answers under.
async function nameOf(db: Db, accountId: string): Promise<string> {
  const [{ displayName }] = await db.query<{ displayName: string | null }>(
    'select display_name as "displayName" from accounts where id = $1',
    [accountId],
  );
  if (!displayName)
    throw new HTTPException(409, { message: "Add your name first" });
  return displayName;
}

// The organizer's calendar day; an unknown timezone falls back to UTC.
function todayIn(timezone: string | undefined): string {
  try {
    return localDate(new Date(), timezone ?? "UTC");
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// No 0, 1, i, l or o: the suffix is read aloud as often as tapped.
const slugAlphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const slugSuffix = () =>
  Array.from(
    { length: 6 },
    () => slugAlphabet[randomInt(slugAlphabet.length)],
  ).join("");

// The title as ASCII letters and digits joined by dashes, at most 30
// characters: the readable part of /i/<slug>.
function slugify(title: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return words.slice(0, 30).replace(/-$/, "") || "event";
}

async function insertEvent(
  tx: Tx,
  organizerId: string,
  input: CreateEvent,
  title: string,
  questions: Question[],
): Promise<string> {
  const base = slugify(title);
  for (;;) {
    const [row] = await tx.query<{ id: string }>(
      `insert into events (organizer_id, slug, title, description, window_start, window_end, questions)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)
       on conflict (slug) do nothing returning id`,
      [
        organizerId,
        `${base}-${slugSuffix()}`,
        title,
        input.description,
        input.windowStart,
        input.windowEnd,
        JSON.stringify(questions),
      ],
    );
    if (row) return row.id;
  }
}

// The event as one account sees it, with its invite link on the origin the
// API gives out. Answers come along only for the organizer, and never a
// budget: answerLines leaves it out.
async function eventView(
  db: Db,
  event: EventRow,
  accountId: string,
  origin: string,
): Promise<EventView> {
  const isOrganizer = event.organizerId === accountId;
  const [responses, itineraries] = await Promise.all([
    db.query<ResponseRow>(
      `select ${responseColumns} from responses where event_id = $1 order by created_at`,
      [event.id],
    ),
    loadItineraries(db, event.id),
  ]);
  return {
    event: {
      id: event.id,
      url: `${origin}/i/${event.slug}`,
      title: event.title,
      windowStart: event.windowStart,
      windowEnd: event.windowEnd,
      questions: event.questions,
    },
    organizer: event.organizer,
    isOrganizer,
    responses: responses.map((r) => ({
      id: r.id,
      name: r.name,
      attending: r.attending,
      answered: r.attending && r.answers !== null,
      you: r.accountId === accountId,
      answers:
        isOrganizer && r.answers ? answerLines(event.questions, r.answers) : [],
    })),
    itineraries,
    stale: itineraries.length > 0 && event.itinerariesVersion !== event.version,
  };
}

function assertOrganizer(event: EventRow, accountId: string, verb: string) {
  if (event.organizerId !== accountId)
    throw new HTTPException(403, {
      message: `Only the organizer can ${verb} this event`,
    });
}

// The organizer, or someone whose answers are linked to their account.
async function assertInvited(db: Db, event: EventRow, accountId: string) {
  if (event.organizerId === accountId) return;
  const [response] = await db.query(
    "select 1 from responses where event_id = $1 and account_id = $2",
    [event.id, accountId],
  );
  if (!response)
    throw new HTTPException(403, { message: "Not invited to this event" });
}

export function events(
  db: Db,
  setup: SetupModel,
  dates: DatesModel,
  invites: InviteOptions = {},
) {
  const app = new Hono<AppEnv>();

  app.get("/me", async (c) => {
    const accountId = account(c);
    const [{ email, displayName, color }] = await db.query<{
      email: string;
      displayName: string | null;
      color: AvatarColor;
    }>(
      `select email, display_name as "displayName", color
       from accounts where id = $1`,
      [accountId],
    );
    const events = await db.query<EventSummary>(
      `select e.id, e.title, e.window_start::text as "windowStart",
         e.window_end::text as "windowEnd", e.organizer_id = $1 as "isOrganizer",
         (select count(*) from responses r where r.event_id = e.id and r.attending)::int as "in",
         (select count(*) from responses r where r.event_id = e.id and not r.attending)::int as "out"
       from events e
       where e.organizer_id = $1
         or exists (select 1 from responses r where r.event_id = e.id and r.account_id = $1)
       order by e.created_at desc`,
      [accountId],
    );
    return c.json({ email, displayName, color, events } satisfies Me);
  });

  // Every answer the account gave follows the name, so a rename can't leave
  // an old one on an event.
  app.put("/me/name", async (c) => {
    const { displayName } = await body(c, UpdateName);
    const accountId = account(c);
    await db.transaction(async (tx) => {
      await tx.query("update accounts set display_name = $2 where id = $1", [
        accountId,
        displayName,
      ]);
      await tx.query("update responses set name = $2 where account_id = $1", [
        accountId,
        displayName,
      ]);
    });
    return c.json({ displayName } satisfies UpdateName);
  });

  app.post("/dates", async (c) => {
    const input = await body(c, ReadDates);
    const read = await readDates(dates, input);
    if (!read)
      throw new HTTPException(422, { message: "Couldn't read those dates" });
    // Code keeps days that only just went by as this year's, so "last week"
    // is told apart from a plan for next November.
    if (read.windowEnd < input.today)
      throw new HTTPException(422, {
        message: "Those days have already passed",
      });
    return c.json(read satisfies DateWindow);
  });

  app.post("/events", async (c) => {
    const input = await body(c, CreateEvent);
    const accountId = account(c);
    const name = await nameOf(db, accountId);
    if (input.windowStart < todayIn(input.timezone))
      throw new HTTPException(400, {
        message: "The event can't start in the past",
      });
    const { title, questions } = await setupEvent(setup, input);
    const id = await db.transaction(async (tx) => {
      const id = await insertEvent(tx, accountId, input, title, questions);
      await tx.query(
        `insert into responses (event_id, account_id, name, attending)
         values ($1, $2, $3, true)`,
        [id, accountId, name],
      );
      return id;
    });
    const event = await requireEvent(db, id);
    return c.json(
      (await eventView(
        db,
        event,
        accountId,
        originOf(invites, c),
      )) satisfies EventView,
      201,
    );
  });

  app.get("/events/:id", async (c) => {
    const accountId = account(c);
    const event = await requireEvent(db, c.req.param("id"));
    await assertInvited(db, event, accountId);
    return c.json(
      (await eventView(
        db,
        event,
        accountId,
        originOf(invites, c),
      )) satisfies EventView,
    );
  });

  // Changed questions make the itineraries stale; a new title alone does not.
  app.put("/events/:id", async (c) => {
    const accountId = account(c);
    const event = await requireEvent(db, c.req.param("id"));
    assertOrganizer(event, accountId, "edit");
    const { title, questions } = await body(c, EditEvent);
    const changed = !isDeepStrictEqual(questions, event.questions);
    await db.query(
      `update events set title = $2, questions = $3::jsonb,
         version = version + case when $4 then 1 else 0 end
       where id = $1`,
      [event.id, title, JSON.stringify(questions), changed],
    );
    const edited = await requireEvent(db, event.id);
    return c.json(
      (await eventView(
        db,
        edited,
        accountId,
        originOf(invites, c),
      )) satisfies EventView,
    );
  });

  app.delete("/events/:id", async (c) => {
    const accountId = account(c);
    const event = await requireEvent(db, c.req.param("id"));
    assertOrganizer(event, accountId, "delete");
    await db.query("delete from events where id = $1", [event.id]);
    return c.json({ ok: true });
  });

  // Someone goes off the list, answers and all, and the options made with
  // them are stale. The organizer's own row stays: it is how they are in.
  app.delete("/events/:id/responses/:responseId", async (c) => {
    const accountId = account(c);
    const event = await requireEvent(db, c.req.param("id"));
    assertOrganizer(event, accountId, "remove someone from");
    const responseId = c.req.param("responseId");
    const [response] = z.uuid().safeParse(responseId).success
      ? await db.query<{ accountId: string | null }>(
          `select account_id as "accountId" from responses
           where id = $1 and event_id = $2`,
          [responseId, event.id],
        )
      : [];
    if (!response)
      throw new HTTPException(404, { message: "Response not found" });
    if (response.accountId === event.organizerId)
      throw new HTTPException(400, {
        message: "The organizer can't be removed",
      });
    await db.transaction(async (tx) => {
      await tx.query("delete from responses where id = $1", [responseId]);
      await tx.query("update events set version = version + 1 where id = $1", [
        event.id,
      ]);
    });
    const after = await requireEvent(db, event.id);
    return c.json(
      (await eventView(
        db,
        after,
        accountId,
        originOf(invites, c),
      )) satisfies EventView,
    );
  });

  return app;
}
