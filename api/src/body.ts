import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";

export async function body<Schema extends z.ZodType>(
  c: Context,
  schema: Schema,
): Promise<z.output<Schema>> {
  const parsed = schema.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) {
    throw new HTTPException(400, {
      res: c.json(
        { error: "Invalid request", issues: parsed.error.issues },
        400,
      ),
    });
  }
  return parsed.data;
}
