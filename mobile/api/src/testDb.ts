import { PGlite } from "@electric-sql/pglite";
import { pgliteDb, type Db } from "./db.ts";
import { migrate } from "./migrate.ts";

export async function testDb(): Promise<Db> {
  const db = pgliteDb(new PGlite());
  await migrate(db);
  return db;
}
