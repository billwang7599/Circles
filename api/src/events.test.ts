import {
  addDays,
  type CreateEvent,
  type EventView,
  localDate,
  type Me,
  presetWindow,
} from "@circles/shared";
import { beforeAll, expect, test } from "vitest";
import { newToken, testApp, today, type TestApp } from "./testApp.ts";
import { scriptedModel, skiTrip } from "./testModel.ts";

let call: TestApp["call"];
let named: TestApp["named"];
let createEvent: TestApp["createEvent"];
let accountId: TestApp["accountId"];
let respond: TestApp["respond"];
let version: TestApp["version"];

beforeAll(async () => {
  ({ call, named, createEvent, accountId, respond, version } = await testApp());
});

const json = async <T>(res: Response) => (await res.json()) as T;
const view = async (id: string, token: string) => {
  const res = await call("GET", `/api/events/${id}`, token);
  expect(res.status).toBe(200);
  return json<EventView>(res);
};

test("creating an event needs a name first", async () => {
  const res = await call("POST", "/api/events", newToken(), {
    description: skiTrip,
    ...presetWindow("nextMonth", today()),
  });
  expect(res.status).toBe(409);
  expect(await res.json()).toEqual({ error: "Add your name first" });
});

test("a new event has an invite link, the organizer's own response and questions suited to the plan", async () => {
  const nicky = await named("Nicky");
  const window = presetWindow("nextMonth", today());
  const created = await createEvent(nicky, window);
  expect(created.event.title).toBe("Ski trip");
  expect(created.event.url).toMatch(
    /^http:\/\/localhost\/i\/ski-trip-[23456789abcdefghjkmnpqrstuvwxyz]{6}$/,
  );
  expect(created.event.windowStart).toBe(window.windowStart);
  expect(created.event.windowEnd).toBe(window.windowEnd);
  expect(created.isOrganizer).toBe(true);
  expect(created.organizer).toEqual({ name: "Nicky" });
  expect(created.responses).toEqual([
    {
      id: expect.any(String),
      name: "Nicky",
      attending: true,
      answered: false,
      you: true,
      answers: [],
    },
  ]);
  expect(created.event.questions.map((q) => q.kind)).toEqual([
    "dates",
    "budget",
    "choice",
    "text",
  ]);
  const resort = created.event.questions.find((q) => q.kind === "choice");
  expect(resort?.title).toBe("Ski resort");
  expect(resort?.choices.map((c) => c.label)).toContain("Blue Mountain");
  const ids = created.event.questions.map((q) => q.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(created.itineraries).toEqual([]);
  expect(created.stale).toBe(false);
  expect(await view(created.event.id, nicky)).toEqual(created);
});

test("the window starts no earlier than the organizer's own day, and must hold together", async () => {
  const nicky = await named("Nicky");
  // The organizer's calendar day decides, wherever they are: the earliest
  // and the latest zones both get their own today.
  for (const timezone of ["Etc/GMT+12", "Etc/GMT-14"]) {
    const day = localDate(new Date(), timezone);
    await createEvent(nicky, { windowStart: day, windowEnd: day, timezone });
  }
  const past = await call("POST", "/api/events", nicky, {
    description: skiTrip,
    windowStart: addDays(today(), -2),
    windowEnd: today(),
  });
  expect(past.status).toBe(400);
  expect(await past.json()).toEqual({
    error: "The event can't start in the past",
  });
  for (const window of [
    { windowStart: today(), windowEnd: addDays(today(), -1) },
    { windowStart: today(), windowEnd: addDays(today(), 90) },
  ]) {
    const res = await call("POST", "/api/events", nicky, {
      description: skiTrip,
      ...window,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { issues: unknown[] }).issues).toHaveLength(
      1,
    );
  }
});

test("only the organizer edits, deletes or reads answers; a claimed respondent reads the rest", async () => {
  const nicky = await named("Nicky");
  const bill = await named("Bill");
  const created = await createEvent(nicky);
  const { id, questions } = created.event;
  const path = `/api/events/${id}`;
  const edit = { title: "Ski weekend", questions };

  expect((await call("GET", path, bill)).status).toBe(403);
  expect((await call("PUT", path, bill, edit)).status).toBe(403);
  expect((await call("DELETE", path, bill)).status).toBe(403);

  const dates = questions.find((q) => q.kind === "dates")!;
  const resort = questions.find((q) => q.kind === "choice")!;
  const start = created.event.windowStart;
  await respond(id, {
    name: "Bill",
    attending: true,
    answers: {
      [dates.id]: {
        kind: "dates",
        ranges: [{ start: addDays(start, 3), end: addDays(start, 5) }],
      },
      [resort.id]: { kind: "choice", choices: [resort.choices[0]!.id] },
    },
    accountId: await accountId(bill),
  });
  const asBill = await view(id, bill);
  expect(asBill.isOrganizer).toBe(false);
  expect(asBill.responses.map((r) => [r.name, r.you, r.answered])).toEqual([
    ["Nicky", false, false],
    ["Bill", true, true],
  ]);
  expect(asBill.responses.every((r) => r.answers.length === 0)).toBe(true);

  const asNicky = await view(id, nicky);
  expect(asNicky.responses[1]!.answers).toEqual([
    { title: dates.title, text: expect.any(String) },
    { title: "Ski resort", text: "Blue Mountain" },
  ]);

  const refused = await call("PUT", path, bill, edit);
  expect(refused.status).toBe(403);
  expect(await refused.json()).toEqual({
    error: "Only the organizer can edit this event",
  });
  expect((await call("DELETE", path, bill)).status).toBe(403);
});

test("editing the questions bumps the version; a new title alone does not", async () => {
  const nicky = await named("Nicky");
  const created = await createEvent(nicky);
  const { id, questions } = created.event;
  const path = `/api/events/${id}`;
  expect(await version(id)).toBe(1);

  const retitled = await call("PUT", path, nicky, {
    title: "Ski weekend",
    questions,
  });
  expect(retitled.status).toBe(200);
  expect((await json<EventView>(retitled)).event.title).toBe("Ski weekend");
  expect(await version(id)).toBe(1);

  const fewer = questions.filter((q) => q.kind !== "text");
  const edited = await call("PUT", path, nicky, {
    title: "Ski weekend",
    questions: fewer,
  });
  expect(edited.status).toBe(200);
  expect((await json<EventView>(edited)).event.questions).toEqual(fewer);
  expect(await version(id)).toBe(2);

  const twoCalendars = await call("PUT", path, nicky, {
    title: "Ski weekend",
    questions: [...fewer, { ...fewer[0]!, id: "again" }],
  });
  expect(twoCalendars.status).toBe(400);
  expect(await version(id)).toBe(2);
});

test("/me lists the account's events with who's in and out, newest first", async () => {
  const nicky = await named("Nicky");
  const bill = await named("Bill");
  const ski = await createEvent(nicky);
  const beach = await createEvent(nicky, {
    description: "Beach day before the summer ends",
  });
  await respond(ski.event.id, {
    name: "Bill",
    attending: true,
    answers: {},
    accountId: await accountId(bill),
  });
  await respond(ski.event.id, { name: "Chloe", attending: true });
  await respond(ski.event.id, { name: "Dana", attending: false });

  const me = await json<Me>(await call("GET", "/api/me", nicky));
  expect(me.displayName).toBe("Nicky");
  expect(me.events).toEqual([
    {
      id: beach.event.id,
      title: "Beach day",
      windowStart: beach.event.windowStart,
      windowEnd: beach.event.windowEnd,
      isOrganizer: true,
      in: 1,
      out: 0,
    },
    {
      id: ski.event.id,
      title: "Ski trip",
      windowStart: ski.event.windowStart,
      windowEnd: ski.event.windowEnd,
      isOrganizer: true,
      in: 3,
      out: 1,
    },
  ]);

  const bills = await json<Me>(await call("GET", "/api/me", bill));
  expect(bills.events.map((e) => [e.id, e.isOrganizer])).toEqual([
    [ski.event.id, false],
  ]);
  const nobody = await json<Me>(await call("GET", "/api/me", newToken()));
  expect(nobody.displayName).toBeNull();
  expect(nobody.events).toEqual([]);
});

test("dates are read from the organizer's words, or 422 when they can't be", async () => {
  const token = newToken();
  const read = await call("POST", "/api/dates", token, {
    text: "December or January",
    today: "2026-11-09",
  });
  expect(read.status).toBe(200);
  expect(await read.json()).toEqual({
    windowStart: "2026-12-01",
    windowEnd: "2027-01-31",
  });

  const unclear = await call("POST", "/api/dates", token, {
    text: "whenever works",
    today: "2026-11-09",
  });
  expect(unclear.status).toBe(422);
  expect(await unclear.json()).toEqual({ error: "Couldn't read those dates" });

  const passed = await call("POST", "/api/dates", token, {
    text: "Nov 2 to 8",
    today: "2026-11-09",
  });
  expect(passed.status).toBe(422);
  expect(await passed.json()).toEqual({
    error: "Those days have already passed",
  });

  const empty = await call("POST", "/api/dates", token, {
    text: "  ",
    today: "2026-11-09",
  });
  expect(empty.status).toBe(400);
});

test("the route hands the model the description, window and timezone as given", async () => {
  const scripted = scriptedModel<CreateEvent>([null, null, null]);
  const t = await testApp({ setup: scripted.model });
  const nicky = await t.named("Nicky");
  const window = presetWindow("nextMonth", today());
  await t.createEvent(nicky, { ...window, timezone: "America/Toronto" });
  expect(scripted.inputs[0]).toEqual({
    description: skiTrip,
    ...window,
    timezone: "America/Toronto",
  });
});

test("a budget never appears in an event, not even one's own", async () => {
  const nicky = await named("Nicky");
  const bill = await named("Bill");
  const created = await createEvent(nicky);
  const { id, questions } = created.event;
  const budget = questions.find((q) => q.kind === "budget")!;
  const dates = questions.find((q) => q.kind === "dates")!;
  const text = questions.find((q) => q.kind === "text")!;
  const start = created.event.windowStart;
  await respond(id, {
    name: "Bill",
    attending: true,
    answers: {
      [budget.id]: { kind: "budget", max: 12345 },
      [dates.id]: {
        kind: "dates",
        ranges: [{ start: addDays(start, 1), end: addDays(start, 2) }],
      },
      [text.id]: { kind: "text", text: "Happy to drive" },
    },
    accountId: await accountId(bill),
  });
  await respond(id, {
    name: "Chloe",
    attending: true,
    answers: { [budget.id]: { kind: "budget", max: 67890 } },
  });
  for (const token of [nicky, bill]) {
    const res = await call("GET", `/api/events/${id}`, token);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain("12345");
    expect(body).not.toContain("67890");
    expect(body).not.toContain('"max"');
    expect(body).not.toContain("$");
  }
  const asNicky = await view(id, nicky);
  expect(asNicky.responses.map((r) => r.answers.map((a) => a.title))).toEqual([
    [],
    [dates.title, text.title],
    [],
  ]);
  expect(asNicky.responses[2]!.answered).toBe(true);
});

test("the organizer deletes an event; unknown ids are 404", async () => {
  const nicky = await named("Nicky");
  const { event } = await createEvent(nicky);
  const path = `/api/events/${event.id}`;
  const res = await call("DELETE", path, nicky);
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect((await call("GET", path, nicky)).status).toBe(404);
  const bogus = await call("GET", "/api/events/not-an-id", nicky);
  expect(bogus.status).toBe(404);
  expect(await bogus.json()).toEqual({ error: "Event not found" });
});

test("the organizer removes someone, which makes the options stale; nobody else can, and not the organizer's own row", async () => {
  const nicky = await named("Nicky");
  const bill = await named("Bill");
  const created = await createEvent(nicky);
  const { id } = created.event;
  const budget = created.event.questions.find((q) => q.kind === "budget")!;
  await respond(id, {
    name: "Bill",
    attending: true,
    answers: {},
    accountId: await accountId(bill),
  });
  await respond(id, {
    name: "Chloe",
    attending: true,
    answers: { [budget.id]: { kind: "budget", max: 12345 } },
  });
  const before = await view(id, nicky);
  const [me, , chloe] = before.responses;
  const path = (responseId: string) =>
    `/api/events/${id}/responses/${responseId}`;
  expect(await version(id)).toBe(1);

  // A respondent, even one who is in, cannot; the row stays.
  const refused = await call("DELETE", path(chloe!.id), bill);
  expect(refused.status).toBe(403);
  expect(await refused.json()).toEqual({
    error: "Only the organizer can remove someone from this event",
  });
  expect((await call("DELETE", path(chloe!.id), newToken())).status).toBe(403);
  expect((await view(id, nicky)).responses).toHaveLength(3);
  expect(await version(id)).toBe(1);

  const removed = await call("DELETE", path(chloe!.id), nicky);
  expect(removed.status).toBe(200);
  const after = await json<EventView>(removed);
  expect(after.responses.map((r) => r.name)).toEqual(["Nicky", "Bill"]);
  expect(JSON.stringify(after)).not.toContain("12345");
  expect(await version(id)).toBe(2);
  expect(await view(id, nicky)).toEqual(after);

  // Gone is gone, junk is nothing, another event's row is not this one's.
  expect((await call("DELETE", path(chloe!.id), nicky)).status).toBe(404);
  expect((await call("DELETE", path("not-an-id"), nicky)).status).toBe(404);
  const otherEvent = await createEvent(nicky);
  expect(
    (
      await call(
        "DELETE",
        `/api/events/${otherEvent.event.id}/responses/${me!.id}`,
        nicky,
      )
    ).status,
  ).toBe(404);
  expect(
    (await call("DELETE", `/api/events/not-an-id/responses/${me!.id}`, nicky))
      .status,
  ).toBe(404);

  const own = await call("DELETE", path(me!.id), nicky);
  expect(own.status).toBe(400);
  expect(await own.json()).toEqual({
    error: "The organizer can't be removed",
  });
  expect((await view(id, nicky)).responses).toHaveLength(2);
  expect(await version(id)).toBe(2);
});

test("a rename reaches the account's own responses", async () => {
  const nicky = await named("Nicky");
  const { event } = await createEvent(nicky);
  await named("Nick", nicky);
  const renamed = await view(event.id, nicky);
  expect(renamed.responses[0]!.name).toBe("Nick");
  expect(renamed.organizer.name).toBe("Nick");
});
