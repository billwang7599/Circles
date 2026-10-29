import { Pool } from "pg";
import { expect, test, vi } from "vitest";
import { pgDb } from "./db.ts";

function pooled() {
  const calls: string[] = [];
  const client = {
    query: vi.fn(async (text: string) => {
      calls.push(text);
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = new Pool();
  vi.spyOn(pool, "connect").mockImplementation(
    (async () => client) as unknown as Pool["connect"],
  );
  return { db: pgDb(pool), calls, client };
}

test("a transaction runs on one pooled client, commits, then releases it", async () => {
  const { db, calls, client } = pooled();
  const result = await db.transaction(async (tx) => {
    await tx.query("select 1");
    return "done";
  });
  expect(result).toBe("done");
  expect(calls).toEqual(["begin", "select 1", "commit"]);
  expect(client.release).toHaveBeenCalledTimes(1);
});

test("a throw inside a transaction rolls back, releases the client and rethrows", async () => {
  const { db, calls, client } = pooled();
  await expect(
    db.transaction(async (tx) => {
      await tx.query("select 1");
      throw new Error("boom");
    }),
  ).rejects.toThrow("boom");
  expect(calls).toEqual(["begin", "select 1", "rollback"]);
  expect(client.release).toHaveBeenCalledTimes(1);
});
