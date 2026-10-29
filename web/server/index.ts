import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";

// Load web/.env if present. Credentials stay on the backend.
try {
  process.loadEnvFile();
} catch {
  // no .env file: use the real environment
}

const port = Number(process.env.PORT ?? 3002);
serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
