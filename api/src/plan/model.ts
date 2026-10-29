import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { AnthropicError, APIError } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  promptFor,
  RankOutput,
  systemPrompt,
  type Ranker,
  type RankerResponse,
} from "./rank.ts";

export function bedrockRanker(region: string, modelId: string): Ranker {
  const client = new AnthropicBedrock({
    awsRegion: region,
    timeout: 15_000,
    maxRetries: 0,
    defaultHeaders: { "anthropic-version": "bedrock-2023-05-31" },
  });
  return {
    model: modelId,
    async rank(input, rejected): Promise<RankerResponse> {
      try {
        const response = await client.messages.parse({
          model: modelId,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: [
                promptFor(input),
                ...rejected.map(
                  (problem) =>
                    `Your previous answer was rejected: ${problem}. Answer again.`,
                ),
              ].join("\n\n"),
            },
          ],
          output_config: { format: zodOutputFormat(RankOutput) },
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
