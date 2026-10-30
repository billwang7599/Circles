// Compare Bedrock models on the planner's one LLM call: ranking.
// Usage (from ai/): AWS_PROFILE=circles npx tsx scripts/benchmark-models.ts [model id ...]
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import type { LanguageModel } from "ai";
import {
  FakeRestaurantClient,
  LlmClient,
  type LlmUsage,
} from "../src/index.ts";

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || "ca-central-1",
  credentialProvider: fromNodeProviderChain(),
});
const CALL_TIMEOUT_MS = 90_000;

interface Variant {
  label: string;
  make: () => LanguageModel;
}

const modelIds =
  process.argv.length > 2
    ? process.argv.slice(2)
    : ["us.anthropic.claude-haiku-4-5-20251001-v1:0"];
const variants: Variant[] = modelIds.map((m) => ({
  label: m,
  make: () => bedrock(m),
}));

const withTimeout = <T>(p: Promise<T>) =>
  Promise.race([
    p,
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("timeout")), CALL_TIMEOUT_MS),
    ),
  ]);

async function run(v: Variant) {
  const usage: LlmUsage[] = [];
  const llm = new LlmClient(v.make(), { onUsage: (u) => usage.push(u) });
  let rankOk = 0;
  const errors: string[] = [];

  const found = await new FakeRestaurantClient().search({
    center: { lat: 43.65, lng: -79.38 },
    radiusKm: 10,
  });
  // Nearest first, as the planner hands them over.
  const candidates = found.map((c, i) => ({
    ...c,
    distanceKm: i * 1.5,
    unmet: [],
  }));
  const ids = new Set(candidates.map((c) => c.id));
  for (let i = 0; i < 2; i++) {
    try {
      const picks = await withTimeout(
        llm.rank({ text: "dinner", candidates, n: 3 }),
      );
      const unique = new Set(picks.map((p) => p.candidateId));
      if (
        picks.length > 0 &&
        picks.length <= 3 &&
        unique.size === picks.length &&
        picks.every((p) => ids.has(p.candidateId))
      )
        rankOk++;
      else errors.push(`rank -> ${JSON.stringify(picks).slice(0, 120)}`);
    } catch (e) {
      errors.push(`rank threw ${(e as Error).name}`);
    }
  }

  const avg = (call: string, f: (u: LlmUsage) => number | undefined) => {
    const xs = usage
      .filter((u) => u.call === call)
      .map(f)
      .filter((x): x is number => x !== undefined);
    return xs.length
      ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
      : 0;
  };
  return {
    label: v.label,
    rank: `${rankOk}/2`,
    rankSec: (avg("rank", (u) => u.ms) / 1000).toFixed(1),
    rankOut: avg("rank", (u) => u.outputTokens),
    thinking: avg("rank", (u) => u.reasoningTokens),
    errors,
  };
}

const results = await Promise.all(variants.map(run));
console.table(results.map((r) => ({ ...r, errors: r.errors.length })));
for (const r of results) {
  if (r.errors.length) console.log(`\n${r.label}:\n  ${r.errors.join("\n  ")}`);
}
