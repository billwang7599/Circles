import { AgentCoreWebClient, FakeWebClient } from "@circles/ai";
import { describe, expect, test } from "vitest";
import { createWebClient } from "./webSearch.ts";

const GATEWAY =
  "https://circles-web-search-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp";

describe("createWebClient", () => {
  test("uses the fake when AGENTCORE_GATEWAY_URL is not set", () => {
    expect(createWebClient({}).client).toBeInstanceOf(FakeWebClient);
  });
  test("uses AgentCore when AGENTCORE_GATEWAY_URL is set", () => {
    const { client, description } = createWebClient({
      AGENTCORE_GATEWAY_URL: GATEWAY,
    });
    expect(client).toBeInstanceOf(AgentCoreWebClient);
    expect(description).toContain("us-east-1");
  });
});
