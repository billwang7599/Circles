import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, test } from "vitest";

const dir = new URL("../migrations/", import.meta.url);

// Booted at import, outside the test's timeout, as testDb.ts does.
const pg = new PGlite();
await pg.waitReady;

async function runThrough(last: string, from = "") {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const name of files)
    if (name > from && name <= last)
      await pg.exec(await readFile(new URL(name, dir), "utf8"));
}

test("accounts take the name they first joined with, and names may repeat", async () => {
  await runThrough("0005_plan_parts.sql");
  await pg.exec(`
    insert into accounts (id, sub, email, color) values
      ('00000000-0000-0000-0000-000000000001', 'a', 'a@example.com', 'violet'),
      ('00000000-0000-0000-0000-000000000002', 'b', 'b@example.com', 'blue');
    insert into circles (id, name, join_code) values
      ('00000000-0000-0000-0000-00000000000a', 'One', 'AAAAAA'),
      ('00000000-0000-0000-0000-00000000000b', 'Two', 'BBBBBB');
    insert into members (account_id, circle_id, name, joined_at) values
      ('00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-00000000000b', 'Later', '2026-02-01'),
      ('00000000-0000-0000-0000-000000000001',
       '00000000-0000-0000-0000-00000000000a', 'Earliest', '2026-01-01');
  `);

  await runThrough("0006_profile.sql", "0005_plan_parts.sql");

  const { rows } = await pg.query<{
    email: string;
    display_name: string | null;
  }>("select email, display_name from accounts order by email");
  expect(rows).toEqual([
    { email: "a@example.com", display_name: "Earliest" },
    { email: "b@example.com", display_name: null },
  ]);
  await pg.exec(`
    insert into members (account_id, circle_id, name) values
      ('00000000-0000-0000-0000-000000000002',
       '00000000-0000-0000-0000-00000000000a', 'earliest');
  `);
});
