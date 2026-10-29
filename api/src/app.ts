import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { authenticate, type AppEnv, type Verifier } from "./auth.ts";
import { circles } from "./circles.ts";
import type { Db } from "./db.ts";
import { log } from "./log.ts";
import { options } from "./options.ts";
import { fakePlaces, fakeRanker } from "./plan/fakes.ts";
import type { PlacesClient } from "./plan/places.ts";
import type { Ranker } from "./plan/rank.ts";
import { plans } from "./plans.ts";
import { votes } from "./votes.ts";

export function createApp(
  db: Db,
  deps: {
    verifier: Verifier;
    cors?: boolean;
    ranker?: Ranker;
    places?: PlacesClient;
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
  // After /api/health, so the health check needs no token.
  app.use("/api/*", authenticate(db, deps.verifier));
  app.route("/api", circles(db));
  app.route("/api", plans(db));
  app.route(
    "/api",
    options(db, deps.ranker ?? fakeRanker(), deps.places ?? fakePlaces()),
  );
  app.route("/api", votes(db));

  return app;
}
