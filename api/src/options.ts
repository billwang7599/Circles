import { areaById, type Place, type PlanView } from "@circles/shared";
import { Hono } from "hono";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { memberOf, type AppEnv } from "./auth.ts";
import type { Db } from "./db.ts";
import { log } from "./log.ts";
import { constraintsFor, type Participant } from "./plan/constraints.ts";
import { filterPlaces, type FilterReason } from "./plan/filters.ts";
import { PlacesUnavailable, type PlacesClient } from "./plan/places.ts";
import { rankCandidates, rankInputFor, type Ranker } from "./plan/rank.ts";
import { slotsIn } from "./plan/slots.ts";
import { assertOpen, loadPlan, planView } from "./plans.ts";

type Reason = "need_two" | "no_free_time" | "no_places" | FilterReason;

const reasons: Record<Reason, string> = {
  need_two: "Need at least two people in",
  no_free_time: "No time when everyone is free",
  no_places: "No places found nearby",
  over_budget: "Nothing fits the budget",
  closed: "Nothing is open then",
  too_far: "Nothing close enough",
};

function impossible(c: Context, reason: Reason): HTTPException {
  return new HTTPException(422, {
    res: c.json({ error: reasons[reason], reason }, 422),
  });
}

function mostRejecting(rejected: Record<FilterReason, number>): Reason {
  const [top] = (Object.entries(rejected) as [FilterReason, number][]).sort(
    (a, b) => b[1] - a[1],
  );
  return top[1] > 0 ? top[0] : "no_places";
}

export function options(db: Db, ranker: Ranker, places: PlacesClient) {
  const app = new Hono<AppEnv>();

  app.post("/circles/:circleId/plans/:planId/options", async (c) => {
    const { circleId, planId } = c.req.param();
    const me = await memberOf(c, db, circleId);
    const plan = await loadPlan(db, planId, circleId);
    assertOpen(plan);
    const [{ exists: regenerating }] = await db.query<{ exists: boolean }>(
      "select exists (select 1 from options where plan_id = $1)",
      [plan.id],
    );
    if (regenerating && me.id !== plan.initiatorId)
      throw new HTTPException(403, {
        message: "Only the initiator can get new options",
      });
    const participants = await db.query<Participant>(
      `select budget_cents as "budgetCents", busy, preferences
       from registrations where plan_id = $1 and attending`,
      [plan.id],
    );
    const area = areaById(plan.areaId);
    const constraints = constraintsFor(
      participants,
      { ...plan, timezone: area.timezone },
      new Date(),
    );
    if (constraints.partySize < 2) throw impossible(c, "need_two");
    const slots = slotsIn(constraints.freeWindows, area.timezone);
    if (slots.length === 0) throw impossible(c, "no_free_time");

    const found = await places
      .search(plan.title, area)
      .catch((err: unknown) => {
        if (err instanceof PlacesUnavailable) {
          log({ call: "places", error: err.message });
          throw new HTTPException(503, {
            message: "Can't look up places right now",
          });
        }
        throw err;
      });
    if (found.length === 0) throw impossible(c, "no_places");
    const { candidates, rejected } = filterPlaces(found, {
      priceCap: constraints.priceCap,
      slots,
      area,
      preferenceTypes: constraints.preferenceTypes,
    });
    if (candidates.length < 2) throw impossible(c, mostRejecting(rejected));

    const ranked = await rankCandidates(
      rankInputFor(plan.title, constraints.preferences, candidates),
      ranker,
    );
    log({
      call: "rank",
      model: ranker.model,
      found: found.length,
      passed: candidates.length,
      picked: ranked.picks.length,
      attempt: ranked.attempt,
      stopReason: ranked.stopReason,
      inputTokens: ranked.inputTokens,
      outputTokens: ranked.outputTokens,
      ms: ranked.ms,
      ranker: ranked.ranker,
      error: ranked.error,
    });

    const byId = new Map(candidates.map((cand) => [cand.place.id, cand]));
    await db.transaction(async (tx) => {
      const [bumped] = await tx.query<{ version: number }>(
        `update plans set version = version + 1, options_version = version + 1
         where id = $1 and version = $2 and status = 'open' returning version`,
        [plan.id, plan.version],
      );
      if (!bumped)
        throw new HTTPException(409, { message: "Inputs changed, try again" });
      await tx.query("delete from options where plan_id = $1", [plan.id]);
      for (const [i, pick] of ranked.picks.entries()) {
        const candidate = byId.get(pick.candidateId)!;
        const place = {
          name: candidate.place.name,
          address: candidate.place.address,
          lat: candidate.place.lat,
          lng: candidate.place.lng,
          rating: candidate.place.rating,
          types: candidate.place.types,
          distanceKm: candidate.distanceKm,
          mapsUrl: candidate.place.mapsUrl,
        } satisfies Place;
        await tx.query(
          `insert into options (plan_id, rank, place_id, place, times, summary, unverified, ranker)
           values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)`,
          [
            plan.id,
            i + 1,
            candidate.place.id,
            JSON.stringify(place),
            JSON.stringify(candidate.times),
            pick.summary,
            candidate.unverified,
            ranked.ranker,
          ],
        );
      }
      return bumped.version;
    });

    const generated = await loadPlan(db, plan.id, circleId);
    return c.json((await planView(db, generated, me)) satisfies PlanView, 201);
  });

  return app;
}
