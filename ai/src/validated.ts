/** The LLM kept returning output that failed validation. Never fall back to unchecked output. */
export class PlannerError extends Error {}

const MAX_ATTEMPTS = 3;

/** Call the model, validate its output, and retry on anything invalid. */
export async function validated<T>(
  call: () => Promise<unknown>,
  check: (raw: unknown) => T,
  what: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return check(await call());
    } catch (e) {
      lastError = e;
    }
  }
  throw new PlannerError(
    `${what} failed validation after ${MAX_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
