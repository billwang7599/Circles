import { Pool, type PoolClient } from "pg";

type Tx = {
  query<Row>(text: string, params?: unknown[]): Promise<Row[]>;
  exec(sql: string): Promise<void>;
};

export type Db = Tx & {
  transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T>;
};

function pgTx(source: Pool | PoolClient): Tx {
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

export function pgDb(source: Pool | PoolClient): Db {
  return {
    ...pgTx(source),
    async transaction(run) {
      const client = source instanceof Pool ? await source.connect() : source;
      try {
        await client.query("begin");
        const result = await run(pgTx(client));
        await client.query("commit");
        return result;
      } catch (err) {
        await client.query("rollback");
        throw err;
      } finally {
        if (client !== source) client.release();
      }
    },
  };
}
