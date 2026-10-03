import { createFakeLlmModel } from "@circles/ai";
import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";

// Picked from scripts/benchmark-models.ts: non-reasoning, so a call takes seconds and
// uses about 100 output tokens. Reasoning models spent 10x more time and tokens here.
const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/**
 * The model the planner runs on. Cloudflare Workers AI over its REST API when the
 * credentials are set, otherwise the fake model so the app still runs with no key.
 */
export function createModel(env: NodeJS.ProcessEnv = process.env): {
  model: LanguageModel;
  description: string;
} {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiKey = env.CLOUDFLARE_API_TOKEN;

  if (accountId && apiKey) {
    const name = env.CLOUDFLARE_MODEL || DEFAULT_MODEL;
    return {
      model: createWorkersAI({ accountId, apiKey })(name),
      description: `Cloudflare Workers AI (${name})`,
    };
  }
  if (accountId || apiKey) {
    throw new Error(
      "Set both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN, or neither.",
    );
  }
  return {
    model: createFakeLlmModel(),
    description: "fake model (no Cloudflare credentials set)",
  };
}
