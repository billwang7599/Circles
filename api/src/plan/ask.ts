// One round trip to a model, as code sees it.
export type ModelResponse = {
  output: unknown;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
};

export type Asked<T> = {
  value?: T;
  attempt: number;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  ms: number;
  // Why there is no value: the model could not be reached, or what was wrong
  // with its last answer once the attempts ran out.
  error?: string;
  // The error is a failure to reach the model, not a bad answer from it.
  unreachable?: true;
  // What was wrong with each answer that was asked again, for tuning.
  problems?: string[];
};

const maxAttempts = 3;

// Asks until an answer passes the check, telling the model what was wrong
// with each rejected one. A model that cannot be reached is not asked again.
export async function askModel<T>(
  ask: (rejected: string[]) => Promise<ModelResponse>,
  check: (output: unknown) => { value: T } | { problem: string },
): Promise<Asked<T>> {
  const started = performance.now();
  const rejected: string[] = [];
  let attempt = 0;
  let stopReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  const done = (rest: {
    value?: T;
    error?: string;
    unreachable?: true;
  }): Asked<T> => ({
    ...rest,
    attempt,
    stopReason,
    inputTokens,
    outputTokens,
    ms: Math.round(performance.now() - started),
    ...(rejected.length ? { problems: [...rejected] } : {}),
  });
  while (attempt < maxAttempts) {
    attempt += 1;
    let response: ModelResponse;
    try {
      response = await ask(rejected);
    } catch (err) {
      return done({
        error: err instanceof Error ? err.message : String(err),
        unreachable: true,
      });
    }
    stopReason = response.stopReason;
    inputTokens += response.inputTokens;
    outputTokens += response.outputTokens;
    const checked = check(response.output);
    if ("value" in checked) return done({ value: checked.value });
    rejected.push(checked.problem);
  }
  return done({ error: rejected.at(-1) });
}
