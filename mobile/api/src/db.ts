import type { PGlite } from "@electric-sql/pglite";
import type { Pool, PoolClient } from "pg";

export type Db = {
  query<Row>(text: string, params?: unknown[]): Promise<Row[]>;
  exec(sql: string): Promise<void>;
};

export function pgDb(source: Pool | PoolClient): Db {
  return {
    async query(text, params = []) {
      const { rows } = await source.query(text, params);
      return rows;
    },
    async exec(sql) {
      await source.query(sql);
    },
  };
}

export function pgliteDb(pg: PGlite): Db {
  return {
    async query<Row>(text: string, params: unknown[] = []) {
      const { rows } = await pg.query<Row>(text, params);
      return rows;
    },
    async exec(sql) {
      await pg.exec(sql);
    },
  };
}
