import { createHash } from "node:crypto";
import type { Answers, EventView, Question } from "@circles/shared";
import { beforeAll, expect, test } from "vitest";
import { createApp } from "./app.ts";
import { devVerifier } from "./auth.ts";
import type { Db } from "./db.ts";
import { testApp, type TestApp } from "./testApp.ts";

const origin = "https://circles.example";
const store = "https://apps.example/circles";

let db: Db;
let app: TestApp["app"];
let call: TestApp["call"];
let named: TestApp["named"];
let accountId: TestApp["accountId"];
let insertEvent: TestApp["insertEvent"];
let respond: TestApp["respond"];
let version: TestApp["version"];
let page: TestApp["page"];
let send: TestApp["send"];
let cookieOf: TestApp["cookieOf"];
let tokenOf: TestApp["tokenOf"];

beforeAll(async () => {
  ({
    app,
    db,
    call,
    named,
    accountId,
    insertEvent,
    respond,
    version,
    page,
    send,
    cookieOf,
    tokenOf,
  } = await testApp({
    invites: { publicUrl: origin, appStoreUrl: store },
  }));
});

const questions: Question[] = [
  {
    id: "dates",
    kind: "dates",
    title: "When are you free?",
    hint: "Tap a start and end date.",
  },
  {
    id: "budget",
    kind: "budget",
    title: "Your budget",
    hint: "For the whole trip.",
    presets: [300, 600, 1000],
  },
  {
    id: "resort",
    kind: "choice",
    title: "Where would you go?",
    hint: "Pick any.",
    choices: [
      { id: "blue", label: "Blue Mountain", detail: "Collingwood, ON" },
      { id: "trem", label: "Mont Tremblant", detail: "QC" },
    ],
  },
  { id: "more", kind: "text", title: "Anything else?", hint: "Gear, carpool." },
];

let made = 0;

// An organizer with their event and their own response, as the API makes them.
async function makeEvent(qs: Question[] = questions) {
  const n = ++made;
  const organizerToken = await named("Alex");
  const organizerId = await accountId(organizerToken);
  const slug = `ski-trip-${n}abcde`;
  const id = await insertEvent(organizerId, {
    slug,
    questions: qs,
    windowStart: "2026-12-01",
    windowEnd: "2027-01-31",
  });
  await respond(id, { name: "Alex", attending: true, accountId: organizerId });
  return { id, slug, organizerToken };
}

async function stored(eventId: string, name: string) {
  const [row] = await db.query<{
    attending: boolean;
    answers: Answers | null;
    accountId: string | null;
  }>(
    `select attending, answers, account_id as "accountId" from responses
     where event_id = $1 and name = $2`,
    [eventId, name],
  );
  return row;
}

// Everything the browser sends as text wrapped in a form control.
const everyControlNamed = (html: string) => {
  const controls = html.match(/<(input|textarea)\b[^>]*>/g) ?? [];
  expect(controls.length).toBeGreaterThan(0);
  for (const control of controls) expect(control).toMatch(/\sname="[^"]+"/);
};

test("the RSVP page shows the event and its preview, and no amount", async () => {
  const event = await makeEvent();
  const res = await page(event.slug);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/html");
  const html = await res.text();
  expect(html).toContain("Alex invited you to");
  expect(html).toContain("<h1>Ski trip</h1>");
  expect(html).toContain("Dec – Jan");
  expect(html).toContain('placeholder="First name"');
  expect(html).toMatch(/name="attending"\s+value="out"/);
  expect(html).toMatch(/name="attending"\s+value="in"/);
  // Return in the name field presses the first submit button: I'm in.
  const submits = html.match(/<button[^>]*type="submit"[^>]*>/g)!;
  expect(submits.length).toBeGreaterThan(2);
  expect(submits[0]).toContain('value="in"');
  expect(submits[0]).toContain('class="vh"');
  expect(html).toContain('id="attending-lbl"');
  expect(html).toContain('property="og:title" content="Ski trip, Dec – Jan"');
  expect(html).toMatch(
    /property="og:description"\s+content="Can you make it\? Answer in a minute, no app needed\."/,
  );
  expect(html).toContain(
    `property="og:image" content="${origin}/i/${event.slug}/preview.png"`,
  );
  expect(html).toContain('property="og:image:width" content="1200"');
  expect(html).toContain('property="og:image:height" content="630"');
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  expect(html).toContain(`<link rel="icon" href="${origin}/i/icon.png"`);
  expect(html).not.toContain("$");
  expect(html).not.toContain("<script");
});

test("I'm in takes a name, sets the cookie and asks the questions", async () => {
  const event = await makeEvent();
  const sent = await send(event.slug, { name: " Ben ", attending: "in" });
  expect(sent.status).toBe(303);
  expect(sent.headers.get("location")).toBe(`/i/${event.slug}`);
  const setCookie = sent.headers.get("set-cookie") ?? "";
  expect(setCookie).toMatch(
    new RegExp(`^response_${event.slug}=[A-Za-z0-9_-]{32};`),
  );
  expect(setCookie).toContain(`Path=/i/${event.slug}`);
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("Secure");
  expect(setCookie).toContain("SameSite=Lax");
  expect(setCookie).toContain(`Max-Age=${180 * 86400}`);
  expect(await version(event.id)).toBe(2);

  const html = await (await page(event.slug, cookieOf(sent))).text();
  expect(html).toContain('value="Ben"');
  expect(html).toContain("Can't make it after all");
  expect(html).not.toContain('id="attending-lbl"');
  expect(html).toContain("When are you free?");
  expect(html).toMatch(/name="day"\s+value="2026-12-01"/);
  expect(html).toMatch(/name="day"\s+value="2027-01-31"/);
  expect(html).not.toMatch(/name="day"\s+value="2026-11-30"/);
  expect(html).toContain("December 2026");
  expect(html).toContain("January 2027");
  expect(html).toContain("Under $300");
  expect(html).toContain("$300 – $600");
  expect(html).toContain("$1,000+");
  expect(html).toContain('name="budgetOther"');
  expect(html).toMatch(/name="q_resort"\s+value="blue"/);
  expect(html).toContain("Collingwood, ON");
  expect(html).toContain('name="q_more"');
  expect(html).toContain("Send my answers");
  expect(html).toContain("<script>");
  everyControlNamed(html);
});

test("answers merge the days into ranges, keep the budget to the page and bump the version", async () => {
  const event = await makeEvent();
  const cookie = cookieOf(
    await send(event.slug, { name: "Ben", attending: "in" }),
  );
  const sent = await send(
    event.slug,
    {
      answers: "1",
      day: [
        "2026-12-14",
        "2026-12-11",
        "2026-12-12",
        "2026-12-13",
        "2026-12-31",
        "2027-01-01",
        "2027-01-02",
        "2026-12-27",
        "2026-12-28",
        "2026-12-29",
        "2026-12-30",
        "2026-12-11",
      ],
      budget: "600",
      q_resort: ["blue", "trem"],
      q_more: "  Need to rent skis.  ",
    },
    cookie,
  );
  expect(sent.status).toBe(303);
  expect(await version(event.id)).toBe(3);
  expect((await stored(event.id, "Ben")).answers).toEqual({
    dates: {
      kind: "dates",
      ranges: [
        { start: "2026-12-11", end: "2026-12-14" },
        { start: "2026-12-27", end: "2027-01-02" },
      ],
    },
    budget: { kind: "budget", max: 600 },
    resort: { kind: "choice", choices: ["blue", "trem"] },
    more: { kind: "text", text: "Need to rent skis." },
  });

  const done = await (await page(event.slug, cookie)).text();
  expect(done).toContain("You're all set!");
  expect(done).toContain("Alex can see you're in.");
  expect(done).toContain("Dec 11 – 14, Dec 27 – Jan 2");
  expect(done).toContain("Blue Mountain, Mont Tremblant");
  expect(done).toContain("Need to rent skis.");
  expect(done).toMatch(/<dt>Budget<\/dt>\s*<dd>Private<\/dd>/);
  expect(done).not.toContain("$");
  expect(done).toContain(`href="/i/${event.slug}?edit"`);
  expect(done).toContain("Can't make it after all");
  expect(done).toContain(`href="${store}"`);
  // The app's scheme, not a link to this same site, which Safari would keep.
  expect(done).toContain(
    `href="circles://invite?slug=${event.slug}&amp;g=${encodeURIComponent(tokenOf(cookie))}"`,
  );

  // Only the page opened with the token knows the amount; a fresh visitor
  // sees the empty form, and the organizer's own page is theirs alone.
  const edit = await (await page(event.slug, cookie, "?edit")).text();
  expect(edit).toMatch(/name="budget"\s+value="600"\s+checked/);
  expect(edit).toMatch(
    /name="day"\s+value="2026-12-12"\s+aria-label="Dec 12"\s+checked/,
  );
  expect(edit).not.toMatch(
    /value="2026-12-15"\s+aria-label="Dec 15"\s+checked/,
  );
  expect(edit).toMatch(/name="q_resort"\s+value="trem"\s+checked/);
  expect(edit).toContain("Need to rent skis.</textarea");
  const stranger = await (await page(event.slug)).text();
  expect(stranger).not.toContain("$");
  expect(stranger).not.toContain("Ben");
  expect(stranger).not.toContain("rent skis");
});

test("another amount wins over the ranges and comes back as typed", async () => {
  const event = await makeEvent();
  const cookie = cookieOf(
    await send(event.slug, { name: "Ben", attending: "in" }),
  );
  expect(
    (
      await send(
        event.slug,
        { answers: "1", budget: "600", budgetOther: "$1,450" },
        cookie,
      )
    ).status,
  ).toBe(303);
  expect((await stored(event.id, "Ben")).answers).toEqual({
    budget: { kind: "budget", max: 1450 },
  });
  const edit = await (await page(event.slug, cookie, "?edit")).text();
  expect(edit).toMatch(/name="budgetOther"\s+value="1450"/);
  expect(edit).not.toMatch(/name="budget"\s+value="[^"]*"\s+checked/);

  // No limit is an answer too.
  await send(event.slug, { answers: "1", budget: "none" }, cookie);
  expect((await stored(event.id, "Ben")).answers).toEqual({
    budget: { kind: "budget", max: null },
  });

  // The name field sits in the same form, so a typo is fixed on the way.
  await send(
    event.slug,
    { answers: "1", budget: "none", name: "Benjamin" },
    cookie,
  );
  expect((await stored(event.id, "Benjamin")).answers).toEqual({
    budget: { kind: "budget", max: null },
  });
  const blank = await send(
    event.slug,
    { answers: "1", budget: "none", name: "" },
    cookie,
  );
  expect(blank.status).toBe(400);
  expect(await blank.text()).toContain("Enter a name");
  // Backing out from the questions page, with the form's own control.
  await send(event.slug, { answers: "1", attending: "out" }, cookie);
  expect((await stored(event.id, "Benjamin")).attending).toBe(false);
});

test("the confirmation lists only what was given, and sells the app only with a store", async () => {
  const event = await makeEvent();
  const cookie = cookieOf(
    await send(event.slug, { name: "Ben", attending: "in" }),
  );
  expect(
    (await send(event.slug, { answers: "1", q_more: "Happy to drive" }, cookie))
      .status,
  ).toBe(303);
  const done = await (await page(event.slug, cookie)).text();
  expect(done).toContain("Happy to drive");
  expect(done).not.toContain("<dt>Budget</dt>");
  expect(done).toContain("Get the Circles app");
  expect(done).toContain(`href="${store}"`);

  const bare = createApp(db, { verifier: devVerifier });
  const plain = await (
    await bare.request(`/i/${event.slug}`, { headers: { cookie } })
  ).text();
  expect(plain).toContain("You're all set!");
  expect(plain).not.toContain("Get the Circles app");
  expect(plain).not.toContain("Get the app");
  expect(plain).toContain("Open in the app");
});

test("declining shows No worries, and a change of mind asks the questions", async () => {
  const event = await makeEvent();
  const sent = await send(event.slug, { name: "Chloe", attending: "out" });
  expect(sent.status).toBe(303);
  const cookie = cookieOf(sent);
  const declined = await (await page(event.slug, cookie)).text();
  expect(declined).toContain("No worries");
  expect(declined).toContain("Alex can see you can't make it.");
  expect(declined).toContain("Changed my mind, I'm in");
  expect(declined).toContain("Get the Circles app");
  expect(declined).not.toContain('name="name"');
  expect((await stored(event.id, "Chloe")).attending).toBe(false);

  const changed = await send(event.slug, { attending: "in" }, cookie);
  expect(changed.status).toBe(303);
  expect(await version(event.id)).toBe(3);
  const asking = await (await page(event.slug, cookie)).text();
  expect(asking).toContain('value="Chloe"');
  expect(asking).toContain("Send my answers");

  // From the questions page, "Can't make it" with an edited name.
  const out = await send(
    event.slug,
    { name: "Chlo", attending: "out" },
    cookie,
  );
  expect(out.status).toBe(303);
  expect(await stored(event.id, "Chlo")).toMatchObject({ attending: false });
  expect(await (await page(event.slug, cookie)).text()).toContain("No worries");
  expect(
    await (
      await page(
        event.slug,
        undefined,
        `?g=${encodeURIComponent(tokenOf(cookie))}`,
      )
    ).text(),
  ).toContain("history.replaceState");
});

test("sending the same answers or RSVP again changes nothing", async () => {
  const event = await makeEvent();
  const cookie = cookieOf(
    await send(event.slug, { name: "Ben", attending: "in" }),
  );
  expect(await version(event.id)).toBe(2);
  const fields = {
    answers: "1",
    day: ["2026-12-11", "2026-12-12"],
    budget: "600",
    q_resort: ["blue"],
    q_more: "Need to rent skis.",
  };
  expect((await send(event.slug, fields, cookie)).status).toBe(303);
  expect(await version(event.id)).toBe(3);
  expect((await send(event.slug, fields, cookie)).status).toBe(303);
  expect(await version(event.id)).toBe(3);
  const same = await send(event.slug, { name: "Ben", attending: "in" }, cookie);
  expect(same.status).toBe(303);
  expect((await send(event.slug, { attending: "in" }, cookie)).status).toBe(
    303,
  );
  expect(await version(event.id)).toBe(3);

  // A changed answer or name still counts.
  await send(event.slug, { ...fields, q_more: "Never mind." }, cookie);
  expect(await version(event.id)).toBe(4);
  await send(event.slug, { name: "Benjamin", attending: "in" }, cookie);
  expect(await version(event.id)).toBe(5);
  expect(await stored(event.id, "Benjamin")).toMatchObject({ attending: true });
});

test("a name already in is asked whether it is the same person, and That's me takes the response over", async () => {
  const event = await makeEvent();
  const names = async () =>
    (
      await db.query<{ name: string }>(
        "select name from responses where event_id = $1 order by created_at",
        [event.id],
      )
    ).map((r) => r.name);
  const phone = cookieOf(
    await send(event.slug, { name: "Ben", attending: "in" }),
  );
  await send(
    event.slug,
    { answers: "1", budget: "600", q_more: "Need to rent skis." },
    phone,
  );
  expect(await version(event.id)).toBe(3);

  // Another browser, the same name give or take case and spacing: the page
  // asks, writes nothing and shows nothing of Ben's.
  const asked = await send(event.slug, { name: " ben ", attending: "in" });
  expect(asked.status).toBe(200);
  expect(asked.headers.get("set-cookie")).toBeNull();
  const html = await asked.text();
  expect(html).toContain("Someone named Ben is already in");
  expect(html).toContain("That's me");
  expect(html).toContain("Someone else");
  expect(html).toMatch(/type="hidden"\s+name="name"\s+value="ben"/);
  expect(html).toMatch(/type="hidden"\s+name="attending"\s+value="in"/);
  expect(html).not.toContain("$");
  expect(html).not.toContain("rent skis");
  expect(html).not.toContain("<script");
  expect(await names()).toEqual(["Alex", "Ben"]);
  expect(await version(event.id)).toBe(3);

  // That's me: this browser opens Ben's response under a token of its own;
  // the browser that made it no longer does. The answers do not come along,
  // since a first name is all it took: the row is asked again, and the
  // options made from it go stale.
  const laptop = cookieOf(
    await send(event.slug, { name: "ben", attending: "in", same: "yes" }),
  );
  expect(tokenOf(laptop)).not.toBe(tokenOf(phone));
  const asking = await (await page(event.slug, laptop)).text();
  expect(asking).toContain("Send my answers");
  expect(asking).not.toContain("rent skis");
  expect(asking).not.toMatch(/name="budget"\s+value="[^"]*"\s+checked/);
  expect(asking).toMatch(/name="budgetOther"\s+value=""/);
  expect(await names()).toEqual(["Alex", "Ben"]);
  expect(await version(event.id)).toBe(4);
  expect(await (await page(event.slug, phone)).text()).toContain(
    'id="attending-lbl"',
  );

  // Someone else: a second Ben, with a response of their own.
  const other = cookieOf(
    await send(event.slug, { name: "Ben", attending: "in", same: "no" }),
  );
  expect(await (await page(event.slug, other)).text()).toContain(
    "Send my answers",
  );
  expect(await names()).toEqual(["Alex", "Ben", "Ben"]);
  expect(await version(event.id)).toBe(5);

  // The organizer's name is nobody's to take, and a name that can't make it
  // is not in the way.
  expect(
    (await send(event.slug, { name: "Alex", attending: "in" })).status,
  ).toBe(303);
  cookieOf(await send(event.slug, { name: "Chloe", attending: "out" }));
  const chloe = cookieOf(
    await send(event.slug, { name: "Chloe", attending: "in" }),
  );
  expect(await names()).toEqual([
    "Alex",
    "Ben",
    "Ben",
    "Alex",
    "Chloe",
    "Chloe",
  ]);

  // Can't make it under a name that is in asks too; That's me turns that
  // response around, which the options have to know.
  const out = await send(event.slug, { name: "Chloe", attending: "out" });
  expect(out.status).toBe(200);
  expect(await out.text()).toMatch(
    /type="hidden"\s+name="attending"\s+value="out"/,
  );
  const was = await version(event.id);
  const turned = cookieOf(
    await send(event.slug, { name: "Chloe", attending: "out", same: "yes" }),
  );
  expect(await (await page(event.slug, turned)).text()).toContain("No worries");
  expect(await version(event.id)).toBe(was + 1);
  expect(await (await page(event.slug, chloe)).text()).toContain(
    'id="attending-lbl"',
  );
  expect(await names()).toEqual([
    "Alex",
    "Ben",
    "Ben",
    "Alex",
    "Chloe",
    "Chloe",
  ]);
});

test("with no questions, I'm in goes straight to the confirmation", async () => {
  const event = await makeEvent([]);
  const cookie = cookieOf(
    await send(event.slug, { name: "Ben", attending: "in" }),
  );
  const html = await (await page(event.slug, cookie)).text();
  expect(html).toContain("You're all set!");
  expect(html).not.toContain("Send my answers");
  expect(html).not.toContain("Change my answers");
  expect(html).not.toContain("<dt>Budget</dt>");
  expect(html).toContain("Can't make it after all");
  const edit = await (await page(event.slug, cookie, "?edit")).text();
  expect(edit).toContain("You're all set!");
  // Opened from the link, the page takes the token out of the address bar.
  expect(html).toContain("history.replaceState");
});

test("answers are checked and kept on the form", async () => {
  const event = await makeEvent();
  const unnamed = await send(event.slug, { name: "  ", attending: "in" });
  expect(unnamed.status).toBe(400);
  expect(await unnamed.text()).toContain("Enter a name");
  const undecided = await send(event.slug, { name: "Ben" });
  expect(undecided.status).toBe(400);
  expect(await undecided.text()).toContain("Say whether you can make it");
  expect(await version(event.id)).toBe(1);

  const cookie = cookieOf(
    await send(event.slug, { name: "Ben", attending: "in" }),
  );
  const bad = await send(
    event.slug,
    {
      answers: "1",
      budgetOther: "lots",
      q_more: "Need to rent skis.",
      day: "2026-12-11",
    },
    cookie,
  );
  expect(bad.status).toBe(400);
  const html = await bad.text();
  expect(html).toContain("Enter a whole dollar amount");
  expect(html).toContain('value="lots"');
  expect(html).toContain("Need to rent skis.</textarea");
  expect(html).toMatch(/value="2026-12-11"\s+aria-label="Dec 11"\s+checked/);
  expect((await stored(event.id, "Ben")).answers).toBeNull();

  const long = await send(
    event.slug,
    { answers: "1", q_more: "x".repeat(501) },
    cookie,
  );
  expect(long.status).toBe(400);
  expect(await long.text()).toContain("At most 500 characters");

  // Without the token, answers go nowhere.
  const stray = await send(event.slug, { answers: "1", q_more: "hi" });
  expect(stray.status).toBe(303);
  expect(await version(event.id)).toBe(2);
});

test("days outside the window and unknown options are refused, not dropped", async () => {
  const event = await makeEvent();
  const cookie = cookieOf(
    await send(event.slug, { name: "Ben", attending: "in" }),
  );
  const given = { answers: "1", day: "2026-12-11", q_resort: "blue" };
  expect((await send(event.slug, given, cookie)).status).toBe(303);
  const before = (await stored(event.id, "Ben")).answers;
  expect(before).toEqual({
    dates: {
      kind: "dates",
      ranges: [{ start: "2026-12-11", end: "2026-12-11" }],
    },
    resort: { kind: "choice", choices: ["blue"] },
  });
  expect(await version(event.id)).toBe(3);

  const outside = await send(
    event.slug,
    { ...given, day: ["2026-12-11", "2027-02-01"] },
    cookie,
  );
  expect(outside.status).toBe(400);
  expect(await outside.text()).toContain("Pick days from the calendar");
  const notADay = await send(event.slug, { ...given, day: "tomorrow" }, cookie);
  expect(notADay.status).toBe(400);
  const unknown = await send(
    event.slug,
    { ...given, q_resort: ["blue", "nope"] },
    cookie,
  );
  expect(unknown.status).toBe(400);
  expect(await unknown.text()).toMatch(
    /id="q_resort-err">Pick from the options/,
  );
  expect((await stored(event.id, "Ben")).answers).toEqual(before);
  expect(await version(event.id)).toBe(3);
});

test("the event takes at most 100 responses", async () => {
  const event = await makeEvent();
  for (let i = 1; i < 100; i++)
    await respond(event.id, {
      name: `Guest ${i}`,
      attending: true,
      tokenHash: `hash${i}`,
    });
  const full = await send(event.slug, { name: "Late", attending: "in" });
  expect(full.status).toBe(409);
  expect(await full.text()).toContain("This event is full");
  expect(full.headers.get("set-cookie")).toBeNull();
  expect(
    await db.query(
      "select 1 from responses where event_id = $1 and name = 'Late'",
      [event.id],
    ),
  ).toEqual([]);
});

test("a form posted from another site is turned away", async () => {
  const event = await makeEvent();
  const foreign = await send(
    event.slug,
    { name: "Eve", attending: "in" },
    undefined,
    { origin: "https://evil.example" },
  );
  expect(foreign.status).toBe(403);
  expect(await foreign.text()).toContain(
    "That didn&#39;t come from the invite page",
  );
  expect(foreign.headers.get("set-cookie")).toBeNull();
  expect(await stored(event.id, "Eve")).toBeUndefined();
  expect(await version(event.id)).toBe(1);

  // From the page itself, at its public address or the one it was served
  // from, the form goes through.
  for (const [own, name] of [
    [origin, "Ben"],
    ["http://localhost", "Bea"],
  ]) {
    const sent = await send(event.slug, { name, attending: "in" }, undefined, {
      origin: own,
    });
    expect(sent.status).toBe(303);
  }
});

test("behind a proxy that ends TLS, with no public URL, the scheme comes from its header", async () => {
  const bare = createApp(db, { verifier: devVerifier });
  const event = await makeEvent();
  const plain = await send(
    event.slug,
    { name: "Ben", attending: "in" },
    undefined,
    {},
    bare,
  );
  expect(plain.status).toBe(303);
  expect(plain.headers.get("set-cookie")).not.toContain("Secure");
  const forwarded = await send(
    event.slug,
    { name: "Bea", attending: "in" },
    undefined,
    { "x-forwarded-proto": "https" },
    bare,
  );
  expect(forwarded.status).toBe(303);
  expect(forwarded.headers.get("set-cookie")).toContain("Secure");

  const html = await (
    await bare.request(`/i/${event.slug}`, {
      headers: { "x-forwarded-proto": "https" },
    })
  ).text();
  expect(html).toContain(
    `property="og:image" content="https://localhost/i/${event.slug}/preview.png"`,
  );
  const link = await bare.request(`/api/events/${event.id}/answers-link`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${event.organizerToken}`,
      "x-forwarded-proto": "https",
    },
  });
  expect(link.status).toBe(200);
  expect(((await link.json()) as { url: string }).url).toMatch(
    new RegExp(`^https://localhost/i/${event.slug}\\?g=`),
  );
  const view = await bare.request(`/api/events/${event.id}`, {
    headers: {
      authorization: `Bearer ${event.organizerToken}`,
      "x-forwarded-proto": "https",
    },
  });
  expect(((await view.json()) as EventView).event.url).toBe(
    `https://localhost/i/${event.slug}`,
  );
});

test("the invite link the app shows follows the public URL", async () => {
  const event = await makeEvent();
  const view = await call(
    "GET",
    `/api/events/${event.id}`,
    event.organizerToken,
  );
  expect(view.status).toBe(200);
  expect(((await view.json()) as EventView).event.url).toBe(
    `${origin}/i/${event.slug}`,
  );
});

test("an unknown link is a 404, and a token for another event is no token", async () => {
  expect((await page("nope")).status).toBe(404);
  expect(await (await page("nope")).text()).toContain(
    "This link doesn&#39;t work",
  );
  expect((await send("nope", { name: "Ben", attending: "in" })).status).toBe(
    404,
  );
  expect((await app.request("/i/nope/preview.png")).status).toBe(404);

  const a = await makeEvent();
  const b = await makeEvent();
  const cookie = cookieOf(await send(a.slug, { name: "Ben", attending: "in" }));
  const elsewhere = await (
    await page(b.slug, undefined, `?g=${encodeURIComponent(tokenOf(cookie))}`)
  ).text();
  expect(elsewhere).toContain('placeholder="First name"');
  expect(elsewhere).not.toContain('value="Ben"');
  const stale = await page(b.slug, `response_${b.slug}=${tokenOf(cookie)}`);
  expect(await stale.text()).toContain('id="attending-lbl"');

  // The link with ?g= sets the cookie for its own event, and the page then
  // takes the token out of the address bar.
  const linked = await page(
    a.slug,
    undefined,
    `?g=${encodeURIComponent(tokenOf(cookie))}`,
  );
  expect(linked.headers.get("set-cookie")).toContain(cookie);
  const linkedHtml = await linked.text();
  expect(linkedHtml).toContain('value="Ben"');
  expect(linkedHtml).toContain("history.replaceState");
});

test("a trailing slash is sent to the page; a body no browser form sends is a 400", async () => {
  const event = await makeEvent();
  const slashed = await app.request(`/i/${event.slug}/?g=abc`);
  expect(slashed.status).toBe(301);
  expect(slashed.headers.get("location")).toBe(`/i/${event.slug}?g=abc`);
  // Junk that is not a slug is a 404, never a header.
  expect((await app.request("/i/abc%0D%0Ax/")).status).toBe(404);

  const json = await app.request(`/i/${event.slug}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Ben", attending: "in" }),
  });
  expect(json.status).toBe(400);
  expect(await json.text()).toContain(
    "That didn&#39;t come from the invite page",
  );
  const nul = await send(event.slug, { name: "Ben\0", attending: "in" });
  expect(nul.status).toBe(400);
  expect(nul.headers.get("set-cookie")).toBeNull();
  expect(
    await db.query("select name from responses where event_id = $1", [
      event.id,
    ]),
  ).toEqual([{ name: "Alex" }]);
  expect(await version(event.id)).toBe(1);
});

test("the preview is a PNG for the chat", async () => {
  const event = await makeEvent();
  const res = await app.request(`/i/${event.slug}/preview.png`);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/png");
  expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  const bytes = new Uint8Array(await res.arrayBuffer());
  expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  const icon = await app.request("/i/icon.png");
  expect(icon.status).toBe(200);
  expect(icon.headers.get("content-type")).toBe("image/png");
});

test("a signed-in account claims its answers once", async () => {
  const event = await makeEvent();
  const cookie = cookieOf(
    await send(event.slug, { name: "Dana", attending: "in" }),
  );
  const token = tokenOf(cookie);
  const dana = "dev:dana@example.com";

  const wrong = await call("POST", `/api/invites/${event.slug}/claim`, dana, {
    token: "nope",
  });
  expect(wrong.status).toBe(404);
  const nowhere = await call("POST", "/api/invites/nope/claim", dana, {
    token,
  });
  expect(nowhere.status).toBe(404);

  const claimed = await call("POST", `/api/invites/${event.slug}/claim`, dana, {
    token,
  });
  expect(claimed.status).toBe(200);
  expect(await claimed.json()).toEqual({ eventId: event.id });
  const [account] = await db.query<{ id: string; displayName: string }>(
    'select id, display_name as "displayName" from accounts where email = $1',
    ["dana@example.com"],
  );
  expect(account.displayName).toBe("Dana");
  expect((await stored(event.id, "Dana")).accountId).toBe(account.id);
  // Nothing about the answers changed, so the options are not stale.
  expect(await version(event.id)).toBe(2);

  // Again is harmless; another account cannot take it; one response each.
  expect(
    (await call("POST", `/api/invites/${event.slug}/claim`, dana, { token }))
      .status,
  ).toBe(200);
  const other = await call(
    "POST",
    `/api/invites/${event.slug}/claim`,
    "dev:other@example.com",
    { token },
  );
  expect(other.status).toBe(409);
  expect(await other.json()).toEqual({
    error: "This link was already used by someone else",
  });
  const second = tokenOf(
    cookieOf(await send(event.slug, { name: "Dana again", attending: "in" })),
  );
  const twice = await call("POST", `/api/invites/${event.slug}/claim`, dana, {
    token: second,
  });
  expect(twice.status).toBe(409);
  expect(await twice.json()).toEqual({
    error: "You already answered this one",
  });
  expect((await stored(event.id, "Dana again")).accountId).toBeNull();

  // A name already chosen stays.
  const named = "dev:named@example.com";
  await call("POST", `/api/invites/${event.slug}/claim`, named, {
    token: second,
  });
  await db.query("update accounts set display_name = 'Sam' where email = $1", [
    "named@example.com",
  ]);
  const third = await makeEvent();
  const t3 = tokenOf(
    cookieOf(await send(third.slug, { name: "Samuel", attending: "in" })),
  );
  expect(
    (
      await call("POST", `/api/invites/${third.slug}/claim`, named, {
        token: t3,
      })
    ).status,
  ).toBe(200);
  expect(
    await db.query(
      'select display_name as "displayName" from accounts where email = $1',
      ["named@example.com"],
    ),
  ).toEqual([{ displayName: "Sam" }]);
});

test("an answers link mints a fresh token and retires the old one", async () => {
  const event = await makeEvent();
  const first = await call(
    "POST",
    `/api/events/${event.id}/answers-link`,
    event.organizerToken,
  );
  expect(first.status).toBe(200);
  const { url } = (await first.json()) as { url: string };
  expect(url).toMatch(
    new RegExp(`^${origin}/i/${event.slug}\\?g=[A-Za-z0-9_-]{32}$`),
  );
  const g = new URL(url).searchParams.get("g")!;
  const mine = await page(event.slug, undefined, `?g=${g}`);
  const html = await mine.text();
  expect(html).toContain('value="Alex"');
  expect(html).toContain("Send my answers");
  expect(html).toContain("history.replaceState");
  expect(mine.headers.get("set-cookie")).toContain(
    `response_${event.slug}=${g}`,
  );

  const second = await call(
    "POST",
    `/api/events/${event.id}/answers-link`,
    event.organizerToken,
  );
  const next = new URL(
    ((await second.json()) as { url: string }).url,
  ).searchParams.get("g")!;
  expect(next).not.toBe(g);
  expect(
    await (await page(event.slug, undefined, `?g=${g}`)).text(),
  ).not.toContain('value="Alex"');
  expect(
    await (await page(event.slug, undefined, `?g=${next}`)).text(),
  ).toContain('value="Alex"');

  // Someone with no response here, or no such event, gets nothing.
  const outsider = await call(
    "POST",
    `/api/events/${event.id}/answers-link`,
    "dev:out@example.com",
  );
  expect(outsider.status).toBe(403);
  expect(
    (
      await call(
        "POST",
        "/api/events/not-an-id/answers-link",
        event.organizerToken,
      )
    ).status,
  ).toBe(404);
  expect(
    (await call("POST", `/api/events/${event.id}/answers-link`, "")).status,
  ).toBe(401);

  // A claimed respondent can ask too.
  const cookie = cookieOf(
    await send(event.slug, { name: "Dana", attending: "in" }),
  );
  const dana = "dev:dana2@example.com";
  await call("POST", `/api/invites/${event.slug}/claim`, dana, {
    token: tokenOf(cookie),
  });
  const hers = await call("POST", `/api/events/${event.id}/answers-link`, dana);
  expect(hers.status).toBe(200);
  const hg = new URL(
    ((await hers.json()) as { url: string }).url,
  ).searchParams.get("g")!;
  expect(
    await (await page(event.slug, undefined, `?g=${hg}`)).text(),
  ).toContain('value="Dana"');

  // The browser she answered from still knows her: her link from the app
  // retires only the app's own previous link, so opening the group-chat
  // link again changes her response rather than making a second one.
  expect(await (await page(event.slug, cookie)).text()).toContain(
    'value="Dana"',
  );
  // Opening her app link in that same browser leaves its cookie alone: the
  // link's token rotates, and a cookie set from it would die with the next.
  const inBrowser = await page(event.slug, cookie, `?g=${hg}`);
  expect(await inBrowser.text()).toContain('value="Dana"');
  expect(inBrowser.headers.get("set-cookie")).toBeNull();
  const again = await call(
    "POST",
    `/api/events/${event.id}/answers-link`,
    dana,
  );
  expect(again.status).toBe(200);
  const hg2 = new URL(
    ((await again.json()) as { url: string }).url,
  ).searchParams.get("g")!;
  expect(await (await page(event.slug, cookie)).text()).toContain(
    'value="Dana"',
  );
  expect((await send(event.slug, { attending: "out" }, cookie)).status).toBe(
    303,
  );
  expect(
    await db.query(
      `select attending from responses where event_id = $1 and name = 'Dana'`,
      [event.id],
    ),
  ).toEqual([{ attending: false }]);
  expect(
    await (await page(event.slug, undefined, `?g=${hg2}`)).text(),
  ).toContain("No worries");
});

test("a response someone claimed in the app is nobody's to take over by name", async () => {
  const event = await makeEvent();
  const cookie = cookieOf(
    await send(event.slug, { name: "Bill", attending: "in" }),
  );
  const bill = "dev:bill-claims@example.com";
  expect(
    (
      await call("POST", `/api/invites/${event.slug}/claim`, bill, {
        token: tokenOf(cookie),
      })
    ).status,
  ).toBe(200);
  // The same name from a browser that knows no response is a new person,
  // not a question about Bill's row.
  const other = await send(event.slug, { name: "bill", attending: "in" });
  expect(other.status).toBe(303);
  expect(await other.text()).not.toContain("already in");
  expect(
    await db.query<{ name: string; claimed: boolean }>(
      `select name, account_id is not null as claimed from responses
       where event_id = $1 and lower(name) = 'bill' order by created_at`,
      [event.id],
    ),
  ).toEqual([
    { name: "Bill", claimed: true },
    { name: "bill", claimed: false },
  ]);
});

test("once the window has passed, the link says so and takes nothing", async () => {
  const organizerToken = await named("Alex");
  const organizerId = await accountId(organizerToken);
  const slug = "ski-trip-over";
  const id = await insertEvent(organizerId, {
    slug,
    questions,
    windowStart: "2026-01-05",
    windowEnd: "2026-01-11",
  });
  await respond(id, { name: "Alex", attending: true, accountId: organizerId });
  const answers: Answers = { more: { kind: "text", text: "Bringing snacks" } };
  await respond(id, {
    name: "Ben",
    attending: true,
    answers,
    tokenHash: createHash("sha256").update("bens-token").digest("hex"),
  });
  const cookie = `response_${slug}=bens-token`;

  for (const res of [await page(slug), await page(slug, cookie)]) {
    expect(res.status).toBe(410);
    const html = await res.text();
    expect(html).toContain("This event has ended");
    expect(html).toContain("Ski trip, Jan 5 – 11, 2026");
    expect(html).not.toContain('name="attending"');
  }
  expect((await send(slug, { name: "Chloe", attending: "in" })).status).toBe(
    410,
  );
  expect(
    (await send(slug, { answers: "1", q_more: "Changed" }, cookie)).status,
  ).toBe(410);
  expect((await send(slug, { attending: "out" }, cookie)).status).toBe(410);
  expect((await stored(id, "Ben")).answers).toEqual(answers);
  expect(
    await db.query(
      "select count(*)::int as count from responses where event_id = $1",
      [id],
    ),
  ).toEqual([{ count: 2 }]);
  expect(await version(id)).toBe(1);
});

test("iOS is told which app opens the links, once a team is named", async () => {
  const path = "/.well-known/apple-app-site-association";
  const res = await createApp(db, {
    verifier: devVerifier,
    invites: { publicUrl: origin, appleTeamId: "ABCDE12345" },
  }).request(path);
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toMatch(/^application\/json\b/);
  expect(await res.json()).toEqual({
    applinks: {
      details: [
        {
          appIDs: ["ABCDE12345.ca.circles.app"],
          components: [{ "/": "/i/*", "?": { g: "?*" } }],
        },
      ],
    },
  });
  // Without a team there is no app to name, so iOS finds nothing.
  expect((await app.request(path)).status).toBe(404);
});
