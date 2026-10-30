import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { createFakeLlmModel } from "@circles/ai";
import type { LanguageModel } from "ai";

export function createModel(env: NodeJS.ProcessEnv = process.env): {
  model: LanguageModel;
  description: string;
} {
  const modelId = env.BEDROCK_MODEL_ID;
  if (!modelId) {
    return {
      model: createFakeLlmModel(),
      description: "fake model (BEDROCK_MODEL_ID not set)",
    };
  }
  const region = env.AWS_REGION || "ca-central-1";
  const bedrock = createAmazonBedrock({
    region,
    credentialProvider: fromNodeProviderChain(),
  });
  return {
    model: bedrock(modelId),
    description: `Bedrock ${modelId} (${region})`,
  };
}
