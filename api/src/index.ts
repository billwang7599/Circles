import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Pool } from "pg";
import { z } from "zod";
import { createApp } from "./app.ts";
import { pgDb } from "./db.ts";
import { log } from "./log.ts";
import { migrate } from "./migrate.ts";
import { fakePlaces, fakeRanker } from "./plan/fakes.ts";
import { bedrockRanker } from "./plan/model.ts";
import { googlePlaces } from "./plan/places.ts";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    NODE_ENV: z.string().default("development"),
    AWS_REGION: z.string().default("ca-central-1"),
    BEDROCK_MODEL_ID: z.string().default(""),
    GOOGLE_PLACES_API_KEY: z.string().default(""),
    GOOGLE_PLACES_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  })
  .parse(process.env);

const ranker = env.BEDROCK_MODEL_ID
  ? bedrockRanker(env.AWS_REGION, env.BEDROCK_MODEL_ID)
  : fakeRanker();
const places = env.GOOGLE_PLACES_API_KEY
  ? googlePlaces(env.GOOGLE_PLACES_API_KEY, env.GOOGLE_PLACES_MAX_REQUESTS)
  : fakePlaces();

const pool = new Pool({ connectionString: env.DATABASE_URL });
const client = await pool.connect();
await migrate(pgDb(client));
client.release();

const app = createApp(pgDb(pool), {
  cors: env.NODE_ENV !== "production",
  ranker,
  places,
});
serve({ fetch: app.fetch, port: env.PORT }, () =>
  log({
    env: env.NODE_ENV,
    port: env.PORT,
    ranker: ranker.model,
    places: env.GOOGLE_PLACES_API_KEY ? "google" : "fake",
  }),
);
