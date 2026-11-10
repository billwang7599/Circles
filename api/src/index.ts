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
import { bedrockDates, fakeDates } from "./plan/dates.ts";
import { bedrockItineraries, fakeItineraries } from "./plan/itinerary.ts";
import { bedrockSetup, fakeSetup } from "./plan/setup.ts";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    PUBLIC_URL: z.string().default(""),
    APP_STORE_URL: z.string().default(""),
    DATABASE_URL: z.string().min(1),
    NODE_ENV: z.string().default("development"),
    AWS_REGION: z.string().default("ca-central-1"),
    BEDROCK_MODEL_ID: z.string().default(""),
    COGNITO_USER_POOL_ID: z.string().default(""),
    COGNITO_CLIENT_ID: z.string().default(""),
  })
  .parse(process.env);

const verifier = verifierFor(env);

// One model for every feature, on Bedrock through the default credential
// chain when one is named; the fakes otherwise.
const models = env.BEDROCK_MODEL_ID
  ? {
      setup: bedrockSetup(env.AWS_REGION, env.BEDROCK_MODEL_ID),
      dates: bedrockDates(env.AWS_REGION, env.BEDROCK_MODEL_ID),
      itineraries: bedrockItineraries(env.AWS_REGION, env.BEDROCK_MODEL_ID),
    }
  : {
      setup: fakeSetup(),
      dates: fakeDates(),
      itineraries: fakeItineraries(),
    };

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
  },
});
serve({ fetch: app.fetch, port: env.PORT }, () =>
  log({
    env: env.NODE_ENV,
    port: env.PORT,
    model: models.setup.model,
    auth: verifier === devVerifier ? "dev" : "cognito",
  }),
);
