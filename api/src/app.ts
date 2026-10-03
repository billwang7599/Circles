import {
  LlmClient,
  PlannerError,
  changePlan,
  RequestLimitError,
  planEvent,
  type PlanDeps,
} from "@circles/ai";
import { z } from "zod";
import {
  PlanRequestSchema,
  type PlanJob,
  type PlanResponse,
} from "@circles/shared";
import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { createModel } from "./model.ts";
import { PlanStore } from "./plans.ts";
import { createRestaurantClient } from "./restaurants.ts";

export function defaultDeps(): PlanDeps {
  const llm = createModel();
  const restaurants = createRestaurantClient();
  console.log(`LLM: ${llm.description}`);
  console.log(`Restaurants: ${restaurants.description}`);
  const client = new LlmClient(llm.model, {
    onUsage: (u) =>
      console.log(
        `LLM ${u.call}: ${u.ms}ms, in ${u.inputTokens ?? "?"}, out ${u.outputTokens ?? "?"}` +
          (u.reasoningTokens ? ` (reasoning ${u.reasoningTokens})` : ""),
      ),
  });
  return { llm: client, restaurants: restaurants.client };
}

export interface AppOptions {
  /** How often an idle event stream sends a keep-alive ping. Default 20 seconds. */
  heartbeatMs?: number;
  store?: PlanStore;
}

const isFinished = (j: PlanJob) => j.status === "done" || j.status === "failed";

export function createApp(
  deps: PlanDeps = defaultDeps(),
  { heartbeatMs = 20_000, store = new PlanStore({ deps }) }: AppOptions = {},
) {
  const app = new Hono();

  /** The request body as a valid PlanRequest, or the error response to send back. */
  async function readRequest(c: Context) {
    const body = await c.req.json().catch(() => undefined);
    const parsed = PlanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return {
        error: c.json(
          { error: "invalid request", issues: parsed.error.issues },
          400,
        ),
      };
    }
    return { request: parsed.data };
  }

  app.get("/health", (c) => c.json({ ok: true }));

  // Waits for the whole run. Prefer POST /plans, which works in the background.
  app.post("/plan", async (c) => {
    const read = await readRequest(c);
    if (read.error) return read.error;
    try {
      const result: PlanResponse = await planEvent(read.request, deps);
      return c.json(result);
    } catch (e) {
      if (e instanceof PlannerError) return c.json({ error: e.message }, 502);
      if (e instanceof RequestLimitError)
        return c.json({ error: e.message }, 429);
      throw e;
    }
  });

  // Start a plan in the background and return its id straight away.
  app.post("/plans", async (c) => {
    const read = await readRequest(c);
    if (read.error) return read.error;
    return c.json(store.submit(read.request), 202);
  });

  // Chat about a plan. The message is read as a change to the plan's request; if anything
  // changed, a new run starts straight away and its job is returned to watch.
  app.post("/plans/chat", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    const parsed = z
      .object({
        message: z.string().trim().min(1).max(500),
        request: PlanRequestSchema,
      })
      .safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid request", issues: parsed.error.issues },
        400,
      );
    }
    try {
      const change = await changePlan(
        parsed.data.request,
        parsed.data.message,
        deps.llm,
      );
      if (change.changes.length === 0) {
        return c.json({ changed: false, changes: [], request: change.request });
      }
      return c.json(
        {
          changed: true,
          changes: change.changes,
          request: change.request,
          job: store.submit(change.request),
        },
        202,
      );
    } catch (e) {
      if (e instanceof PlannerError) return c.json({ error: e.message }, 502);
      throw e;
    }
  });

  app.get("/plans/:id", (c) => {
    const job = store.get(c.req.param("id"));
    return job ? c.json(job) : c.json({ error: "plan not found" }, 404);
  });

  // Server-Sent Events: the current state first, then every change, then close once the
  // plan finishes. A ping comment goes out whenever the stream is quiet, so proxies and
  // load balancers don't drop it as idle.
  app.get("/plans/:id/events", (c) => {
    const id = c.req.param("id");
    const initial = store.get(id);
    if (!initial) return c.json({ error: "plan not found" }, 404);

    return streamSSE(c, async (stream) => {
      let latest: PlanJob = initial;
      let wake: () => void = () => {};
      const unsubscribe = store.subscribe(id, (job) => {
        latest = job;
        wake();
      });
      stream.onAbort(() => {
        unsubscribe();
        wake();
      });
      try {
        let sent: PlanJob | undefined;
        while (!stream.aborted) {
          if (latest !== sent) {
            sent = latest;
            await stream.writeSSE({
              event: "update",
              data: JSON.stringify(sent),
            });
            if (isFinished(sent)) break;
          }
          let timer: ReturnType<typeof setTimeout> | undefined;
          await new Promise<void>((resolve) => {
            wake = resolve;
            timer = setTimeout(resolve, heartbeatMs);
            if (latest !== sent) resolve(); // changed while we were busy
          });
          clearTimeout(timer);
          if (latest === sent && !stream.aborted)
            await stream.write(": ping\n\n");
        }
      } finally {
        unsubscribe();
      }
    });
  });

  return app;
}
