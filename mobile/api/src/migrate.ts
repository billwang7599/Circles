import { readdir, readFile } from "node:fs/promises";
import type { Db } from "./db.ts";

const dir = new URL("../migrations/", import.meta.url);

export async function migrate(db: Db) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  await db.exec("begin; select pg_advisory_xact_lock(1)");
  const [{ exists }] = await db.query<{ exists: boolean }>(
    "select to_regclass('schema_migrations') is not null as exists",
  );
  const applied = new Set(
    exists
      ? (
          await db.query<{ name: string }>("select name from schema_migrations")
        ).map((r) => r.name)
      : [],
  );
  for (const name of files) {
    if (applied.has(name)) continue;
    await db.exec(await readFile(new URL(name, dir), "utf8"));
    await db.query("insert into schema_migrations (name) values ($1)", [name]);
  }
  await db.exec("commit");
}
