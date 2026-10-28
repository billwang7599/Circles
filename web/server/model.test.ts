import { describe, expect, test } from "vitest";
import { createModel } from "./model.ts";

describe("createModel", () => {
  test("uses the fake model when no credentials are set", () => {
    expect(createModel({}).description).toContain("fake");
  });
  test("uses Cloudflare Workers AI when both credentials are set", () => {
    const { model, description } = createModel({
      CLOUDFLARE_ACCOUNT_ID: "acct",
      CLOUDFLARE_API_TOKEN: "token",
    });
    expect(description).toContain("Cloudflare Workers AI");
    expect(typeof model).toBe("object");
    expect((model as { modelId: string }).modelId).toBe(
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    );
  });
  test("CLOUDFLARE_MODEL overrides the default model", () => {
    const { model } = createModel({
      CLOUDFLARE_ACCOUNT_ID: "a",
      CLOUDFLARE_API_TOKEN: "t",
      CLOUDFLARE_MODEL: "@cf/openai/gpt-oss-120b",
    });
    expect((model as { modelId: string }).modelId).toBe(
      "@cf/openai/gpt-oss-120b",
    );
  });
  test("one credential without the other is an error", () => {
    expect(() => createModel({ CLOUDFLARE_ACCOUNT_ID: "a" })).toThrow();
    expect(() => createModel({ CLOUDFLARE_API_TOKEN: "t" })).toThrow();
  });
});
