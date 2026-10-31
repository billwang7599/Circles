import { describe, expect, test } from "vitest";
import { createModel } from "./model.ts";

const MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0";

describe("createModel", () => {
  test("uses the fake model when BEDROCK_MODEL_ID is not set", () => {
    expect(createModel({}).description).toContain("fake");
  });
  test("uses Bedrock when BEDROCK_MODEL_ID is set", () => {
    const { model, description } = createModel({ BEDROCK_MODEL_ID: MODEL_ID });
    expect(description).toBe(`Bedrock ${MODEL_ID} (ca-central-1)`);
    expect((model as { modelId: string }).modelId).toBe(MODEL_ID);
  });
  test("AWS_REGION overrides the default region", () => {
    const { description } = createModel({
      BEDROCK_MODEL_ID: MODEL_ID,
      AWS_REGION: "us-east-1",
    });
    expect(description).toContain("(us-east-1)");
  });
});
