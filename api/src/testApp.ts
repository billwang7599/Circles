import {
  presetWindow,
  type Answers,
  type CreateEvent,
  type EventView,
  type Question,
} from "@circles/shared";
import { expect } from "vitest";
import { createApp } from "./app.ts";
import { devVerifier } from "./auth.ts";
import { testDb } from "./testDb.ts";
import { skiTrip } from "./testModel.ts";

let accounts = 0;
export const newToken = () => `dev:person${++accounts}@example.com`;

export const today = () => new Date().toISOString().slice(0, 10);

export async function testApp(
  deps: Partial<Parameters<typeof createApp>[1]> = {},
) {
  const db = await testDb();
  const app = createApp(db, { verifier: devVerifier, ...deps });

  function call(method: string, path: string, token?: string, data?: unknown) {
    return app.request(path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }

  async function named(displayName: string, token = newToken()) {
    const res = await call("PUT", "/api/me/name", token, { displayName });
    expect(res.status).toBe(200);
    return token;
  }

  async function createEvent(
    token: string,
    overrides: Partial<CreateEvent> = {},
  ): Promise<EventView> {
    const res = await call("POST", "/api/events", token, {
      description: skiTrip,
      ...presetWindow("nextMonth", today()),
      ...overrides,
    });
    expect(res.status).toBe(201);
    return (await res.json()) as EventView;
  }

  const accountId = async (token: string) =>
    (
      await db.query<{ id: string }>("select id from accounts where sub = $1", [
        token,
      ])
    )[0]!.id;

  // An event written to the table as is, for a fixed window and question ids.
  async function insertEvent(
    organizerId: string,
    event: {
      slug: string;
      questions: Question[];
      windowStart: string;
      windowEnd: string;
    },
  ) {
    const [row] = await db.query<{ id: string }>(
      `insert into events (organizer_id, slug, title, description, window_start, window_end, questions)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb) returning id`,
      [
        organizerId,
        event.slug,
        "Ski trip",
        skiTrip,
        event.windowStart,
        event.windowEnd,
        JSON.stringify(event.questions),
      ],
    );
    return row!.id;
  }

  // What the invite page or a claim would write, without going through them.
  async function respond(
    eventId: string,
    response: {
      name: string;
      attending: boolean;
      answers?: Answers | null;
      accountId?: string | null;
      tokenHash?: string;
    },
  ) {
    await db.query(
      `insert into responses (event_id, account_id, token_hash, name, attending, answers)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        eventId,
        response.accountId ?? null,
        response.tokenHash ?? null,
        response.name,
        response.attending,
        response.answers ? JSON.stringify(response.answers) : null,
      ],
    );
  }

  async function version(eventId: string) {
    const [row] = await db.query<{ version: number }>(
      "select version from events where id = $1",
      [eventId],
    );
    return row!.version;
  }

  // The invite page, as someone in the group chat sees it.
  const page = (slug: string, cookie?: string, query = "") =>
    app.request(`/i/${slug}${query}`, { headers: cookie ? { cookie } : {} });

  // The form as a browser sends it back.
  function send(
    slug: string,
    fields: Record<string, string | string[]>,
    cookie?: string,
    headers: Record<string, string> = {},
    to = app,
  ) {
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(fields))
      for (const v of [value].flat()) params.append(name, v);
    return to.request(`/i/${slug}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: params.toString(),
    });
  }

  // Only the RSVP sets the cookie; answers just send the page back to itself.
  const cookieOf = (res: Response) => {
    expect(res.status).toBe(303);
    const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
    expect(cookie.startsWith("response_")).toBe(true);
    return cookie;
  };
  const tokenOf = (cookie: string) => decodeURIComponent(cookie.split("=")[1]!);

  return {
    app,
    db,
    call,
    named,
    createEvent,
    accountId,
    insertEvent,
    respond,
    version,
    page,
    send,
    cookieOf,
    tokenOf,
  };
}

export type TestApp = Awaited<ReturnType<typeof testApp>>;
