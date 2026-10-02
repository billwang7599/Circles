import {
  FakePlacesClient,
  LlmClient,
  createFakeLlmModel,
  PlannerError,
  planEvent,
  type PlanDeps,
} from "@circles/ai";
import {
  PlanRequestSchema,
  findCity,
  type PlanResponse,
} from "@circles/shared";
import { Hono } from "hono";

// TODO(ai-connector): pass a real AI SDK model to LlmClient and a real PlacesClient.
export const defaultDeps = (): PlanDeps => ({
  llm: new LlmClient(createFakeLlmModel()),
  places: new FakePlacesClient(),
});

export function createApp(deps: PlanDeps = defaultDeps()) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/plan", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    const parsed = PlanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "invalid request", issues: parsed.error.issues },
        400,
      );
    }
    if (!findCity(parsed.data.group.city)) {
      return c.json({ error: `unknown city: ${parsed.data.group.city}` }, 400);
    }
    try {
      const result: PlanResponse = await planEvent(parsed.data, deps);
      return c.json(result);
    } catch (e) {
      if (e instanceof PlannerError) return c.json({ error: e.message }, 502);
      throw e;
    }
  });

  return app;
}
