import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { authenticate, type AppEnv, type Verifier } from "./auth.ts";
import type { Db } from "./db.ts";
import { events } from "./events.ts";
import { inviteClaims, invitePages, type InviteOptions } from "./invites.ts";
import { itineraries } from "./itineraries.ts";
import { log } from "./log.ts";
import { fakeDates, type DatesModel } from "./plan/dates.ts";
import { fakeItineraries, type ItineraryModel } from "./plan/itinerary.ts";
import { fakeSetup, type SetupModel } from "./plan/setup.ts";

export function createApp(
  db: Db,
  deps: {
    verifier: Verifier;
    cors?: boolean;
    setup?: SetupModel;
    dates?: DatesModel;
    itineraries?: ItineraryModel;
    invites?: InviteOptions;
  },
) {
  const app = new Hono<AppEnv>();

  app.use(async (c, next) => {
    const start = performance.now();
    await next();
    log({
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - start),
      accountId: c.get("accountId"),
    });
  });
  if (deps.cors) app.use(cors());

  app.onError((err, c) => {
    if (err instanceof HTTPException)
      return err.res ?? c.json({ error: err.message }, err.status);
    log({ error: err.message, stack: err.stack });
    return c.json({ error: "Something went wrong" }, 500);
  });
  app.notFound((c) => c.json({ error: "Not found" }, 404));

  app.get("/api/health", async (c) => {
    await db.query("select 1");
    return c.json({ ok: true });
  });
  // The invite pages need no token either: the link is the key.
  app.route("/", invitePages(db, deps.invites));
  // After /api/health, so the health check needs no token.
  app.use("/api/*", authenticate(db, deps.verifier));
  app.route(
    "/api",
    events(
      db,
      deps.setup ?? fakeSetup(),
      deps.dates ?? fakeDates(),
      deps.invites,
    ),
  );
  app.route("/api", inviteClaims(db, deps.invites));
  app.route("/api", itineraries(db, deps.itineraries ?? fakeItineraries()));

  return app;
}
