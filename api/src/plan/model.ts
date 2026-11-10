import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { AnthropicError, APIError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { ModelResponse } from "./ask.ts";

// A model-backed feature as code calls it: one round trip per attempt, with
// the problems found in earlier answers so the model knows what to fix.
export type Model<Input> = {
  model: string;
  fn(input: Input, rejected: string[]): Promise<ModelResponse>;
};

// A feature on Bedrock: one system prompt, one output shape, and the input
// written out as the user turn, as JSON unless the feature says otherwise.
// The timeout is per round trip, in milliseconds; a long answer needs more.
// An answer the SDK cannot parse counts as a bad answer and is asked again;
// an API failure is thrown.
export function bedrockModel<Input>(
  region: string,
  modelId: string,
  opts: {
    system: string;
    maxTokens: number;
    format: z.ZodType;
    content?(input: Input): string;
    timeout?: number;
  },
): Model<Input> {
  const client = new AnthropicBedrock({
    awsRegion: region,
    timeout: opts.timeout ?? 15_000,
    maxRetries: 0,
    defaultHeaders: { "anthropic-version": "bedrock-2023-05-31" },
  });
  const content =
    opts.content ?? ((input: Input) => JSON.stringify(input, null, 2));
  return {
    model: modelId,
    async fn(input, rejected) {
      try {
        const response = await client.messages.parse({
          model: modelId,
          max_tokens: opts.maxTokens,
          system: opts.system,
          messages: [
            {
              role: "user",
              content: [
                content(input),
                ...rejected.map(
                  (problem) =>
                    `Your previous answer was rejected: ${problem}. Answer again.`,
                ),
              ].join("\n\n"),
            },
          ],
          output_config: { format: zodOutputFormat(opts.format) },
        });
        return {
          output: response.parsed_output,
          stopReason: response.stop_reason,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        };
      } catch (err) {
        if (err instanceof AnthropicError && !(err instanceof APIError))
          return {
            output: null,
            stopReason: null,
            inputTokens: 0,
            outputTokens: 0,
          };
        throw err;
      }
    },
  };
}
