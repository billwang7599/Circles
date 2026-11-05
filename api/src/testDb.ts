import { PGlite } from "@electric-sql/pglite";
import type { Db } from "./db.ts";
import { migrate } from "./migrate.ts";

function pgliteDb(pg: PGlite): Db {
  return {
    async query<Row>(text: string, params: unknown[] = []) {
      const { rows } = await pg.query<Row>(text, params);
      return rows;
    },
    async exec(sql) {
      await pg.exec(sql);
    },
    transaction(run) {
      return pg.transaction((tx) =>
        run({
          async query<Row>(text: string, params: unknown[] = []) {
            const { rows } = await tx.query<Row>(text, params);
            return rows;
          },
          async exec(sql) {
            await tx.exec(sql);
          },
        }),
      );
    },
  };
}

// PGlite takes seconds to boot on CI, so each test file boots one at import, outside any test's
// timeout, and every testDb() call wipes it.
const pg = new PGlite();
await pg.waitReady;
const db = pgliteDb(pg);

export async function testDb(): Promise<Db> {
  await db.exec("drop schema public cascade; create schema public");
  await migrate(db);
  return db;
}
