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

export async function testDb(): Promise<Db> {
  const db = pgliteDb(new PGlite());
  await migrate(db);
  return db;
}
