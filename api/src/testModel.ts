import type { ModelResponse } from "./plan/ask.ts";

export const skiTrip = "Ski trip with Ben and Chloe, somewhere we can drive to";

// A model that answers from a script, one answer per attempt, and keeps the
// inputs and rejections it was given so tests can check them.
export function scriptedModel<Input = unknown>(outputs: unknown[]) {
  const rejections: string[][] = [];
  const inputs: Input[] = [];
  const model = {
    model: "scripted",
    async fn(input: Input, rejected: string[]): Promise<ModelResponse> {
      inputs.push(input);
      rejections.push([...rejected]);
      return {
        output: outputs[rejections.length - 1],
        stopReason: "end_turn",
        inputTokens: 10,
        outputTokens: 5,
      };
    },
  };
  return { model, rejections, inputs };
}
