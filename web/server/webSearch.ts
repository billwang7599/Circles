import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { AgentCoreWebClient, FakeWebClient, type WebClient } from "@circles/ai";

export function createWebClient(env: NodeJS.ProcessEnv = process.env): {
  client: WebClient;
  description: string;
} {
  const gatewayUrl = env.AGENTCORE_GATEWAY_URL;
  if (!gatewayUrl) {
    return {
      client: new FakeWebClient(),
      description: "fake web search (AGENTCORE_GATEWAY_URL not set)",
    };
  }
  return {
    client: new AgentCoreWebClient({
      gatewayUrl,
      credentials: fromNodeProviderChain(),
    }),
    description: `AgentCore web search (${new URL(gatewayUrl).hostname})`,
  };
}
