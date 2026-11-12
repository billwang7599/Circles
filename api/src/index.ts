import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Pool } from "pg";
import { z } from "zod";
import { createApp } from "./app.ts";
import { devVerifier, verifierFor } from "./auth.ts";
import { pgDb } from "./db.ts";
import { settlePendingDays } from "./itineraries.ts";
import { log } from "./log.ts";
import { migrate } from "./migrate.ts";
import { modelsFor } from "./plan/models.ts";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    PUBLIC_URL: z.string().default(""),
    APP_STORE_URL: z.string().default(""),
    APPLE_TEAM_ID: z.string().default(""),
    DATABASE_URL: z.string().min(1),
    NODE_ENV: z.string().default("development"),
    AWS_REGION: z.string().default("ca-central-1"),
    BEDROCK_MODEL_ID: z.string().default(""),
    // Read by modelsFor, blank for the defaults.
    PLACES_MAX_REQUESTS: z.string().optional(),
    PLACES_BIAS: z.string().optional(),
    COGNITO_USER_POOL_ID: z.string().default(""),
    COGNITO_CLIENT_ID: z.string().default(""),
  })
  .parse(process.env);

const verifier = verifierFor(env);

const models = modelsFor(env);

const pool = new Pool({ connectionString: env.DATABASE_URL });
const client = await pool.connect();
await migrate(pgDb(client));
await settlePendingDays(pgDb(client));
client.release();

const app = createApp(pgDb(pool), {
  verifier,
  cors: env.NODE_ENV !== "production",
  ...models,
  invites: {
    publicUrl: env.PUBLIC_URL || undefined,
    appStoreUrl: env.APP_STORE_URL || undefined,
    appleTeamId: env.APPLE_TEAM_ID || undefined,
  },
});
serve({ fetch: app.fetch, port: env.PORT }, () =>
  log({
    env: env.NODE_ENV,
    port: env.PORT,
    model: models.setup.model,
    places: models.places.source,
    auth: verifier === devVerifier ? "dev" : "cognito",
  }),
);
