import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Pool } from "pg";
import { z } from "zod";
import { createApp } from "./app.ts";
import { pgDb } from "./db.ts";
import { log } from "./log.ts";
import { migrate } from "./migrate.ts";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    NODE_ENV: z.string().default("development"),
  })
  .parse(process.env);

const pool = new Pool({ connectionString: env.DATABASE_URL });
const client = await pool.connect();
await migrate(pgDb(client));
client.release();

const app = createApp(pgDb(pool), { cors: env.NODE_ENV !== "production" });
serve({ fetch: app.fetch, port: env.PORT }, () =>
  log({ env: env.NODE_ENV, port: env.PORT }),
);
