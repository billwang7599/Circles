import { addDays, type EventView, type Me } from "@circles/shared";
import { expect, test, vi } from "vitest";
import { newToken, testApp } from "./testApp.ts";

// One event from end to end, across the modules: the organizer creates it in
// the app, invitees answer from the link, the organizer reads the answers
// and makes itineraries, an invitee installs the app and claims their
// answers. Each module's own tests cover its corners; this covers the seams.

// Amounts and the budget field, in what a person or the app would read:
// styles and scripts carry their own numbers.
const money = /\$|"max"|\b(580|470)\b/;
const visible = (html: string) =>
  html.replace(/<(style|script)[\s\S]*?<\/\1>/g, "").replace(/<[^>]*>/g, "");

test("an event goes from a description to itineraries and a claimed invite", async () => {
  const { app, call, named, createEvent, db, page, send, cookieOf, tokenOf } =
    await testApp();
  const alex = await named("Alex");
  const created = await createEvent(alex);
  const { id, windowStart, questions } = created.event;
  const slug = new URL(created.event.url).pathname.split("/").pop()!;
  const choice = questions.find((q) => q.kind === "choice")!;
  const text = questions.find((q) => q.kind === "text")!;

  // Answers don't set a cookie; they just send the page back to itself.
  const redirected = (res: Response) => expect(res.status).toBe(303);

  const stranger = await page(slug);
  expect(stranger.status).toBe(200);
  const strangerHtml = await stranger.text();
  expect(strangerHtml).toContain("Ski trip");
  expect(strangerHtml).toContain("Alex invited you to");
  expect(visible(strangerHtml)).not.toMatch(money);

  // Ben is in and answers everything.
  const ben = cookieOf(await send(slug, { name: "Ben", attending: "in" }));
  expect(await (await page(slug, ben)).text()).toContain("Send my answers");
  redirected(
    await send(
      slug,
      {
        answers: "1",
        day: [windowStart, addDays(windowStart, 1)],
        budget: "none",
        budgetOther: "580",
        [`q_${choice.id}`]: choice.choices[0]!.id,
        [`q_${text.id}`]: "I can drive",
      },
      ben,
    ),
  );
  const benDone = await (await page(slug, ben)).text();
  expect(benDone).toContain("You're all set!");
  expect(benDone).toContain("I can drive");

  // Chloe is in with her own amount; Dana can't make it.
  const chloe = cookieOf(await send(slug, { name: "Chloe", attending: "in" }));
  redirected(
    await send(
      slug,
      { answers: "1", day: windowStart, budget: "none", budgetOther: "470" },
      chloe,
    ),
  );
  const dana = cookieOf(await send(slug, { name: "Dana", attending: "out" }));
  expect(await (await page(slug, dana)).text()).toContain("No worries");

  // The organizer sees who is in and what they said, never what they'd spend.
  const view = async (token: string) => {
    const res = await call("GET", `/api/events/${id}`, token);
    expect(res.status).toBe(200);
    return (await res.json()) as EventView;
  };
  let alexView = await view(alex);
  expect(alexView.responses.map((r) => [r.name, r.attending])).toEqual([
    ["Alex", true],
    ["Ben", true],
    ["Chloe", true],
    ["Dana", false],
  ]);
  const benRow = alexView.responses.find((r) => r.name === "Ben")!;
  expect(benRow.answered).toBe(true);
  expect(benRow.answers.map((a) => a.title)).toContain(text.title);
  expect(benRow.answers.map((a) => a.text)).toContain("I can drive");
  expect(JSON.stringify(alexView)).not.toMatch(money);
  expect(alexView.itineraries).toEqual([]);
  expect(alexView.stale).toBe(false);

  // Itineraries come from the answers as they stand, after the request is
  // answered; a later answer makes them stale.
  const made = await call("POST", `/api/events/${id}/itineraries`, alex, {
    detail: "parts",
  });
  expect(made.status).toBe(202);
  alexView = await vi.waitFor(async () => {
    const polled = await view(alex);
    expect(polled.itineraries.length).toBeGreaterThan(0);
    return polled;
  });
  for (const option of alexView.itineraries) {
    expect(option.of).toBe(3);
    expect(option.start >= windowStart).toBe(true);
  }
  expect(JSON.stringify(alexView)).not.toMatch(money);
  expect(alexView.stale).toBe(false);
  redirected(
    await send(
      slug,
      { answers: "1", day: addDays(windowStart, 2), budget: "600" },
      chloe,
    ),
  );
  alexView = await view(alex);
  expect(alexView.stale).toBe(true);

  // Ben gets the app: his answers follow him, and he sees the event but not
  // what the others said.
  const benApp = newToken();
  const claimed = await call("POST", `/api/invites/${slug}/claim`, benApp, {
    token: tokenOf(ben),
  });
  expect(claimed.status).toBe(200);
  expect(await claimed.json()).toEqual({ eventId: id });
  const me = (await (await call("GET", "/api/me", benApp)).json()) as Me;
  expect(me.displayName).toBe("Ben");
  expect(me.events).toEqual([
    expect.objectContaining({ id, isOrganizer: false, in: 3, out: 1 }),
  ]);
  const benView = await view(benApp);
  expect(benView.isOrganizer).toBe(false);
  expect(benView.responses.find((r) => r.you)?.name).toBe("Ben");
  expect(benView.responses.every((r) => r.answers.length === 0)).toBe(true);
  expect(JSON.stringify(benView)).not.toMatch(money);

  // The organizer answers through the same page as everyone else.
  const link = await call("POST", `/api/events/${id}/answers-link`, alex);
  expect(link.status).toBe(200);
  const { url } = (await link.json()) as { url: string };
  const { pathname, search } = new URL(url);
  expect(pathname).toBe(`/i/${slug}`);
  const alexPage = await app.request(pathname + search);
  expect(alexPage.status).toBe(200);
  const alexHtml = await alexPage.text();
  expect(alexHtml).toContain("Send my answers");
  expect(alexHtml).toContain("Alex");

  // Every change to the answers moved the version the itineraries are
  // checked against.
  const [row] = await db.query<{ version: number; made: number }>(
    "select version, itineraries_version as made from events where id = $1",
    [id],
  );
  expect(row!.version).toBeGreaterThan(row!.made);
});
