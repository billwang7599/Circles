import { expect, test } from "vitest";
import { cachedPlaces } from "./placesCache.ts";
import type { Places } from "./plan/places.ts";
import { testDb } from "./testDb.ts";

test("a name in an area is asked of the map once a month, however it is spelled", async () => {
  const db = await testDb();
  const asked: string[] = [];
  const inner: Places = {
    source: "scripted",
    async search(name, area) {
      asked.push(`${name} @ ${area}`);
      return name === "Kinton Ramen"
        ? [{ name: "Kinton Ramen", address: `51 Baldwin St, ${area}` }]
        : [];
    },
  };
  const places = cachedPlaces(db, inner);
  expect(places.source).toBe("scripted");
  expect(await places.search("Kinton Ramen", "Toronto")).toHaveLength(1);
  // A hit comes back as it was answered.
  expect(await places.search("kinton ramen", "toronto")).toEqual([
    { name: "Kinton Ramen", address: "51 Baldwin St, Toronto" },
  ]);
  expect(await places.search("Kinton Ramen.", "Toronto ")).toHaveLength(1);
  expect(await places.search("Ramen Alley", "Toronto")).toEqual([]);
  expect(await places.search("Ramen Alley", "Toronto")).toEqual([]);
  // Another area is another question; an accent is not.
  expect(await places.search("Kinton Ramen", "Montréal")).toHaveLength(1);
  expect(await places.search("Kinton Ramen", "Montreal")).toHaveLength(1);
  expect(asked).toEqual([
    "Kinton Ramen @ Toronto",
    "Ramen Alley @ Toronto",
    "Kinton Ramen @ Montréal",
  ]);
  expect(
    await db.query(
      "select source, area, name from venue_lookups order by area, name",
    ),
  ).toEqual([
    { source: "scripted", area: "montreal", name: "kinton ramen" },
    { source: "scripted", area: "toronto", name: "kinton ramen" },
    { source: "scripted", area: "toronto", name: "ramen alley" },
  ]);
  // Inside the month a row is still a hit; a month on, the map is asked
  // again and the row is fresh once more.
  await db.query(
    "update venue_lookups set checked_at = now() - interval '29 days' where name = 'ramen alley'",
  );
  expect(await places.search("Ramen Alley", "Toronto")).toEqual([]);
  expect(asked).toHaveLength(3);
  await db.query(
    "update venue_lookups set checked_at = now() - interval '31 days' where name = 'kinton ramen'",
  );
  expect(await places.search("Kinton Ramen", "Toronto")).toHaveLength(1);
  expect(asked).toHaveLength(4);
  expect(await places.search("Kinton Ramen", "Toronto")).toHaveLength(1);
  expect(asked).toHaveLength(4);
  expect(
    await db.query(
      "select checked_at > now() - interval '1 day' as fresh from venue_lookups where area = 'toronto' and name = 'kinton ramen'",
    ),
  ).toEqual([{ fresh: true }]);
});

test("rows belong to the lookup that answered, so the fake's never serve the real map", async () => {
  const db = await testDb();
  const fake: Places = { source: "fake", search: async () => [] };
  let real = 0;
  const location: Places = {
    source: "location",
    async search(name, area) {
      real += 1;
      return [{ name, address: area }];
    },
  };
  expect(
    await cachedPlaces(db, fake).search("Kinton Ramen", "Toronto"),
  ).toEqual([]);
  expect(
    await cachedPlaces(db, location).search("Kinton Ramen", "Toronto"),
  ).toHaveLength(1);
  expect(real).toBe(1);
});

test("two options asking for the same venue at once share one lookup, and a lookup that fails is not remembered", async () => {
  const db = await testDb();
  let calls = 0;
  const slow: Places = {
    source: "slow",
    async search() {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (calls === 1)
        throw new Error("Amazon Location answered ThrottlingException: slow");
      return [];
    },
  };
  const places = cachedPlaces(db, slow);
  // Both callers see the one failure.
  const first = Promise.allSettled([
    places.search("Kinton Ramen", "Toronto"),
    places.search("kinton ramen", "Toronto"),
  ]);
  expect((await first).map((r) => r.status)).toEqual(["rejected", "rejected"]);
  expect(calls).toBe(1);
  // Asked again, once, and the answer is kept this time.
  expect(await places.search("Kinton Ramen", "Toronto")).toEqual([]);
  expect(calls).toBe(2);
  expect(
    await db.query("select count(*)::int as n from venue_lookups"),
  ).toEqual([{ n: 1 }]);
});
