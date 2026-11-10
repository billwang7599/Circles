import type { Answers, Question } from "@circles/shared";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Tx } from "./db.ts";

// An event as every module reads it: the row, with its organizer's name.
export type EventRow = {
  id: string;
  organizerId: string;
  slug: string;
  title: string;
  description: string;
  windowStart: string;
  windowEnd: string;
  questions: Question[];
  version: number;
  itinerariesVersion: number | null;
  organizer: { name: string };
};

// One person's reply as every module reads it. The answers are the shared
// Answers shape: their only writer, the invite page, checks them before saving.
export type ResponseRow = {
  id: string;
  name: string;
  attending: boolean;
  answers: Answers | null;
  accountId: string | null;
};

export const responseColumns = `id, name, attending, answers, account_id as "accountId"`;

const columns = `e.id, e.organizer_id as "organizerId", e.slug, e.title, e.description,
  e.window_start::text as "windowStart", e.window_end::text as "windowEnd",
  e.questions, e.version, e.itineraries_version as "itinerariesVersion",
  json_build_object('name', coalesce(a.display_name, 'The organizer')) as organizer`;

async function find(
  db: Tx,
  where: string,
  params: unknown[],
): Promise<EventRow | undefined> {
  const [event] = await db.query<EventRow>(
    `select ${columns} from events e join accounts a on a.id = e.organizer_id where ${where}`,
    params,
  );
  return event;
}

// The event behind an invite link, or nothing.
export const loadEventBySlug = (db: Tx, slug: string) =>
  find(db, "e.slug = $1", [slug]);

// A malformed id is no event either.
const loadEvent = (db: Tx, id: string) =>
  z.uuid().safeParse(id).success
    ? find(db, "e.id = $1", [id])
    : Promise.resolve(undefined);

// For routes that address an event by id.
export async function requireEvent(db: Tx, id: string): Promise<EventRow> {
  const event = await loadEvent(db, id);
  if (!event) throw new HTTPException(404, { message: "Event not found" });
  return event;
}
