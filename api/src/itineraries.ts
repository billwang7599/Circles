import {
  hasEnded,
  MakeItineraries,
  type Answers,
  type Itinerary,
} from "@circles/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { account, type AppEnv } from "./auth.ts";
import { body } from "./body.ts";
import type { Db, Tx } from "./db.ts";
import { requireEvent } from "./eventRow.ts";
import { log } from "./log.ts";
import {
  itineraryFacts,
  makeItineraries,
  writeDays,
  type ItineraryBody,
  type ItineraryFacts,
  type ItineraryModel,
} from "./plan/itinerary.ts";

// An event's itinerary options, best first.
export async function loadItineraries(
  db: Tx,
  eventId: string,
): Promise<Itinerary[]> {
  const rows = await db.query<{
    id: string;
    rank: number;
    body: ItineraryBody;
  }>(
    "select id, rank, body from itineraries where event_id = $1 order by rank",
    [eventId],
  );
  return rows.map(({ id, rank, body }) => ({ id, rank, ...body }));
}

// A make the last process was stopped inside left its cards waiting for days
// no one will write; at startup they stop waiting, with no days.
export async function settlePendingDays(db: Db) {
  await db.query(
    `update itineraries set body = body || '{"daysPending": false}'::jsonb
     where (body->>'daysPending')::boolean`,
    [],
  );
}

export function itineraries(db: Db, model: ItineraryModel) {
  const app = new Hono<AppEnv>();

  // Makes the options and puts them in place of the event's old ones,
  // stamped with the version the facts were read at; a response or edit
  // after it makes them stale. Their days come after, one call per option
  // at once, each saved as it lands, so the cards wait for none of them. A
  // row replaced by a newer make in the meantime is gone, and its days go
  // nowhere. The request was answered before this runs, so a failure can
  // only be logged.
  async function make(eventId: string, version: number, facts: ItineraryFacts) {
    try {
      const made = await makeItineraries(model.options, facts);
      log({
        call: "itineraries",
        model: model.options.model,
        slots: facts.slots.length,
        made: made.itineraries.length,
        maker: made.maker,
        attempt: made.attempt,
        stopReason: made.stopReason,
        inputTokens: made.inputTokens,
        outputTokens: made.outputTokens,
        ms: made.ms,
        error: made.error,
        problems: made.problems,
      });
      const ids = await db.transaction(async (tx) => {
        await tx.query("delete from itineraries where event_id = $1", [
          eventId,
        ]);
        const ids: string[] = [];
        for (const [i, itinerary] of made.itineraries.entries()) {
          const [row] = await tx.query<{ id: string }>(
            `insert into itineraries (event_id, rank, body)
             values ($1, $2, $3::jsonb) returning id`,
            [eventId, i + 1, JSON.stringify(itinerary)],
          );
          ids.push(row!.id);
        }
        await tx.query(
          "update events set itineraries_version = $2 where id = $1",
          [eventId, version],
        );
        return ids;
      });
      await Promise.all(
        made.itineraries.map(async (itinerary, i) => {
          if (!itinerary.daysPending) return;
          // Whatever becomes of the days, the card stops waiting for them.
          let patch: Record<string, unknown> = { daysPending: false };
          try {
            const written = await writeDays(model.days, facts, itinerary);
            log({
              call: "itinerary-days",
              model: model.days.model,
              rank: i + 1,
              days: written.days.length,
              attempt: written.attempt,
              stopReason: written.stopReason,
              inputTokens: written.inputTokens,
              outputTokens: written.outputTokens,
              ms: written.ms,
              error: written.error,
              problems: written.problems,
            });
            patch = { days: written.days, daysPending: false };
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            log({
              call: "itinerary-days",
              eventId,
              rank: i + 1,
              error: error.message,
              stack: error.stack,
            });
          }
          await db.query(
            "update itineraries set body = body || $2::jsonb where id = $1",
            [ids[i], JSON.stringify(patch)],
          );
        }),
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log({
        call: "itineraries",
        eventId,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  // Checks the request and answers at once: the model can take minutes
  // over the options, longer than the gateway keeps a request open, so they
  // are made after the answer and the app finds them on the event.
  app.post("/events/:eventId/itineraries", async (c) => {
    const accountId = account(c);
    const event = await requireEvent(db, c.req.param("eventId"));
    if (event.organizerId !== accountId)
      throw new HTTPException(403, {
        message: "Only the organizer can make itineraries",
      });
    if (hasEnded(event.windowEnd))
      throw new HTTPException(409, { message: "This event has ended" });
    const { detail } = await body(c, MakeItineraries);
    const attending = await db.query<{ answers: Answers | null }>(
      `select answers from responses
       where event_id = $1 and attending order by created_at`,
      [event.id],
    );
    if (attending.length < 2)
      throw new HTTPException(409, { message: "Need at least two people in" });

    void make(
      event.id,
      event.version,
      itineraryFacts(
        event,
        attending.map((r) => r.answers),
        detail,
      ),
    );
    return c.json({ ok: true }, 202);
  });

  return app;
}
