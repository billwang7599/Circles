import { createFakeLlmModel } from "@circles/ai";
import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";

// Not chosen on evidence yet: pick the model by running the eval fixtures against candidates.
const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";

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
