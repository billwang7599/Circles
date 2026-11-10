import type { Answers, EventView, Itinerary, Question } from "@circles/shared";
import { beforeAll, expect, test, vi } from "vitest";
import type { Db } from "./db.ts";
import { loadItineraries, settlePendingDays } from "./itineraries.ts";
import { fakeItineraries, type ItineraryModel } from "./plan/itinerary.ts";
import { testApp, type TestApp } from "./testApp.ts";

let db: Db;
let call: TestApp["call"];
let named: TestApp["named"];
let accountId: TestApp["accountId"];
let insertEvent: TestApp["insertEvent"];
let respond: TestApp["respond"];

// The fake, with either call held back while a test wants the model slow,
// and the days call swappable for one that fails.
let holdOptions = Promise.resolve();
let holdDays = Promise.resolve();
const fake = fakeItineraries();
let daysFn = fake.days.fn;
const model: ItineraryModel = {
  options: {
    model: fake.options.model,
    async fn(input, rejected) {
      await holdOptions;
      return fake.options.fn(input, rejected);
    },
  },
  days: {
    model: fake.days.model,
    async fn(input, rejected) {
      await holdDays;
      return daysFn(input, rejected);
    },
  },
};

beforeAll(async () => {
  ({ db, call, named, accountId, insertEvent, respond } = await testApp({
    itineraries: model,
  }));
});

const questions: Question[] = [
  { kind: "dates", id: "d", title: "Dates", hint: "" },
  {
    kind: "budget",
    id: "b",
    title: "Your budget",
    hint: "",
    presets: [300, 600],
  },
  {
    kind: "choice",
    id: "r",
    title: "Ski resort",
    hint: "",
    choices: [
      { id: "blue", label: "Blue Mountain", detail: "Collingwood, ON" },
      { id: "tremblant", label: "Mont Tremblant", detail: "Laurentians, QC" },
    ],
  },
];

const answers = (max: number | null, ...choices: string[]): Answers => ({
  d: {
    kind: "dates",
    ranges: [{ start: "2026-12-04", end: "2026-12-06" }],
  },
  b: { kind: "budget", max },
  r: { kind: "choice", choices },
});

const person = async (name: string) => {
  const token = await named(name);
  return { id: await accountId(token), token };
};

let events = 0;

// An organizer's event with the organizer in but unanswered, and the
// invitees given.
async function setUp(
  ...invitees: [name: string, attending: boolean, answers: Answers | null][]
) {
  const organizer = await person("Nicky");
  const eventId = await insertEvent(organizer.id, {
    slug: `ski-trip-${++events}`,
    questions,
    windowStart: "2026-12-04",
    windowEnd: "2026-12-13",
  });
  await respond(eventId, {
    name: "Nicky",
    attending: true,
    accountId: organizer.id,
  });
  for (const [name, attending, answers] of invitees)
    await respond(eventId, { name, attending, answers });
  return { organizer, eventId };
}

const post = (
  eventId: string,
  token?: string,
  data: unknown = { detail: "parts" },
) => call("POST", `/api/events/${eventId}/itineraries`, token, data);

const view = async (eventId: string, token: string) =>
  (await (
    await call("GET", `/api/events/${eventId}`, token)
  ).json()) as EventView;

const eventState = async (eventId: string) => {
  const [row] = await db.query<{
    version: number;
    itinerariesVersion: number | null;
  }>(
    `select version, itineraries_version as "itinerariesVersion"
     from events where id = $1`,
    [eventId],
  );
  return row!;
};

// The options once the server has saved them: the request is answered first.
const saved = (eventId: string, check: (made: Itinerary[]) => void) =>
  vi.waitFor(async () => {
    const made = await loadItineraries(db, eventId);
    check(made);
    return made;
  });

// The options once every one has its days.
const written = (eventId: string, check: (made: Itinerary[]) => void) =>
  saved(eventId, (made) => {
    check(made);
    expect(made.every((itinerary) => !itinerary.daysPending)).toBe(true);
  });

test("only the organizer can make itineraries", async () => {
  const { eventId } = await setUp(["Ben", true, answers(600, "tremblant")]);
  const other = await person("Chloe");
  const res = await post(eventId, other.token);
  expect(res.status).toBe(403);
  expect(await res.json()).toEqual({
    error: "Only the organizer can make itineraries",
  });
  expect(await loadItineraries(db, eventId)).toEqual([]);
});

test("two people must be in", async () => {
  const { organizer, eventId } = await setUp(["Ben", false, null]);
  const res = await post(eventId, organizer.token);
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "Need at least two people in" });
  expect((await eventState(eventId)).itinerariesVersion).toBeNull();
});

test("an event whose window has passed makes no options", async () => {
  const organizer = await person("Nicky");
  const eventId = await insertEvent(organizer.id, {
    slug: "ski-trip-over",
    questions,
    windowStart: "2026-01-05",
    windowEnd: "2026-01-11",
  });
  await respond(eventId, {
    name: "Nicky",
    attending: true,
    accountId: organizer.id,
  });
  await respond(eventId, { name: "Ben", attending: true, answers: null });
  const res = await post(eventId, organizer.token);
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "This event has ended" });
  expect((await eventState(eventId)).itinerariesVersion).toBeNull();
});

test("itineraries are made from the answers, stored ranked and stamped with the version, without any amount", async () => {
  const { organizer, eventId } = await setUp(
    ["Ben", true, answers(600, "tremblant")],
    ["Chloe", true, answers(450, "blue", "tremblant")],
    ["Dana", false, null],
  );
  await db.query("update events set version = 4 where id = $1", [eventId]);

  const res = await post(eventId, organizer.token);
  expect(res.status).toBe(202);
  expect(await res.json()).toEqual({ ok: true });
  // The fake's costs rise by option and the cap is the lowest budget, so only
  // the first fits: the three days both who answered can make. The organizer
  // has not said when, so is not counted free.
  const made = await written(eventId, (made) => expect(made).toHaveLength(1));
  expect(made[0]).toMatchObject({
    rank: 1,
    start: "2026-12-04",
    end: "2026-12-06",
    picks: ["Mont Tremblant"],
    detail: "parts",
    daysPending: false,
    free: 2,
    of: 3,
    overBudget: false,
  });
  expect(made[0]!.days).toHaveLength(3);
  expect(made[0]!.days[0]!.items[0]!.when).toBe("Morning");

  const rows = await db.query<{ body: Record<string, unknown> }>(
    "select body from itineraries where event_id = $1",
    [eventId],
  );
  expect(rows).toHaveLength(1);
  expect(Object.keys(rows[0]!.body)).not.toContain("costPerPerson");
  expect(JSON.stringify(rows)).not.toMatch(/\$|cost|\b450\b|\b600\b/i);
  expect(await eventState(eventId)).toEqual({
    version: 4,
    itinerariesVersion: 4,
  });

  // The app reads them off the event.
  const seen = await view(eventId, organizer.token);
  expect(seen.itineraries).toEqual(made);
  expect(seen.stale).toBe(false);
  expect(JSON.stringify(seen.itineraries)).not.toMatch(
    /\$|cost|\b450\b|\b600\b/i,
  );
});

test("making them again replaces the rows and follows the version", async () => {
  const { organizer, eventId } = await setUp(
    ["Ben", true, answers(null, "tremblant")],
    ["Chloe", true, answers(null, "blue")],
  );
  expect((await post(eventId, organizer.token)).status).toBe(202);
  const before = await saved(eventId, (made) => expect(made).toHaveLength(3));
  expect(before.map((i) => i.rank)).toEqual([1, 2, 3]);

  // Another answer comes in.
  await db.query("update events set version = version + 1 where id = $1", [
    eventId,
  ]);
  expect(await eventState(eventId)).toEqual({
    version: 2,
    itinerariesVersion: 1,
  });

  const again = await post(eventId, organizer.token, { detail: "hours" });
  expect(again.status).toBe(202);
  const after = await written(eventId, (made) =>
    expect(made.map((i) => i.id)).not.toEqual(before.map((i) => i.id)),
  );
  expect(after.map((i) => i.rank)).toEqual([1, 2, 3]);
  for (const item of after.flatMap((i) => i.days.flatMap((d) => d.items)))
    expect(item.when).toMatch(/^\d\d:\d\d$/);
  expect(await eventState(eventId)).toEqual({
    version: 2,
    itinerariesVersion: 2,
  });
});

test("a model still writing does not hold the request: the answer comes at once and the options follow", async () => {
  const { organizer, eventId } = await setUp(
    ["Ben", true, answers(null, "tremblant")],
    ["Chloe", true, answers(null, "blue")],
  );
  const held = Promise.withResolvers<void>();
  holdOptions = held.promise;

  const res = await post(eventId, organizer.token);
  expect(res.status).toBe(202);
  expect(await res.json()).toEqual({ ok: true });
  expect((await view(eventId, organizer.token)).itineraries).toEqual([]);
  expect((await eventState(eventId)).itinerariesVersion).toBeNull();

  held.resolve();
  holdOptions = Promise.resolve();
  const made = await written(eventId, (made) => expect(made).toHaveLength(3));
  const seen = await view(eventId, organizer.token);
  expect(seen.itineraries).toEqual(made);
  expect(seen.stale).toBe(false);
});

test("the cards are saved before any days exist, and the days fill the same rows in afterwards", async () => {
  const { organizer, eventId } = await setUp(
    ["Ben", true, answers(null, "tremblant")],
    ["Chloe", true, answers(null, "blue")],
  );
  await db.query("update events set version = 3 where id = $1", [eventId]);
  const held = Promise.withResolvers<void>();
  holdDays = held.promise;

  expect((await post(eventId, organizer.token)).status).toBe(202);
  const cards = await saved(eventId, (made) => expect(made).toHaveLength(3));
  for (const card of cards)
    expect(card).toMatchObject({ days: [], daysPending: true });
  expect(cards.map((i) => i.rank)).toEqual([1, 2, 3]);
  // Stamped with the version at once: a change from here on makes them stale.
  expect(await eventState(eventId)).toEqual({
    version: 3,
    itinerariesVersion: 3,
  });
  const seen = await view(eventId, organizer.token);
  expect(seen.itineraries).toEqual(cards);
  expect(seen.stale).toBe(false);

  held.resolve();
  holdDays = Promise.resolve();
  const made = await written(eventId, (made) => expect(made).toHaveLength(3));
  expect(made.map((i) => i.id)).toEqual(cards.map((i) => i.id));
  for (const [i, itinerary] of made.entries()) {
    const { days, daysPending, ...card } = itinerary;
    expect(card).toEqual({
      ...cards[i],
      days: undefined,
      daysPending: undefined,
    });
    expect(daysPending).toBe(false);
    expect(days.map((d) => d.date)).toHaveLength(
      new Set(days.map((d) => d.date)).size,
    );
    expect(days[0]!.date).toBe(itinerary.start);
    expect(days.at(-1)!.date).toBe(itinerary.end);
  }
  expect(JSON.stringify(made)).not.toMatch(/\$|cost/i);
  expect(await eventState(eventId)).toEqual({
    version: 3,
    itinerariesVersion: 3,
  });
});

test("an option whose days cannot be written stops waiting for them", async () => {
  const { organizer, eventId } = await setUp(
    ["Ben", true, answers(null, "tremblant")],
    ["Chloe", true, answers(null, "blue")],
  );
  daysFn = async () => {
    throw new Error("connect ECONNREFUSED");
  };
  try {
    expect((await post(eventId, organizer.token)).status).toBe(202);
    const made = await written(eventId, (made) => expect(made).toHaveLength(3));
    expect(made.every((i) => i.days.length === 0)).toBe(true);
  } finally {
    daysFn = fake.days.fn;
  }
});

test("a restart settles cards whose days were never written", async () => {
  const { organizer, eventId } = await setUp(
    ["Ben", true, answers(null, "tremblant")],
    ["Chloe", true, answers(null, "blue")],
  );
  const held = Promise.withResolvers<void>();
  holdDays = held.promise;
  try {
    expect((await post(eventId, organizer.token)).status).toBe(202);
    const cards = await saved(eventId, (made) => expect(made).toHaveLength(3));
    expect(cards.every((i) => i.daysPending)).toBe(true);
    // The process that was writing them is gone; the next one settles them.
    await settlePendingDays(db);
    const settled = await loadItineraries(db, eventId);
    expect(settled.map((i) => [i.daysPending, i.days])).toEqual(
      cards.map(() => [false, []]),
    );
  } finally {
    held.resolve();
    holdDays = Promise.resolve();
  }
});

test("a missing event, a bad body and no token are refused", async () => {
  const { organizer, eventId } = await setUp(["Ben", true, null]);
  expect((await post("not-a-uuid", organizer.token)).status).toBe(404);
  expect(
    (await post("00000000-0000-4000-8000-000000000000", organizer.token))
      .status,
  ).toBe(404);
  const bad = await post(eventId, organizer.token, { detail: "minutes" });
  expect(bad.status).toBe(400);
  expect(await bad.json()).toMatchObject({ error: "Invalid request" });
  expect((await post(eventId)).status).toBe(401);
});
