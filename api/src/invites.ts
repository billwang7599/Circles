import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import {
  addDays,
  answerLines,
  Answers,
  type AnswersLink,
  approxRange,
  budgetRanges,
  ClaimInvite,
  type ClaimResult,
  type DateRange,
  datesIn,
  dayRange,
  DisplayName,
  hasEnded,
  lastDayOf,
  type Question,
  weekdayOf,
} from "@circles/shared";
import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { html, raw } from "hono/html";
import { HTTPException } from "hono/http-exception";
import type { HtmlEscapedString } from "hono/utils/html";
import { account, type AppEnv } from "./auth.ts";
import { body } from "./body.ts";
import type { Db, Tx } from "./db.ts";
import {
  loadEventBySlug,
  requireEvent,
  responseColumns,
  type EventRow,
  type ResponseRow,
} from "./eventRow.ts";
import { previewPng } from "./preview.ts";

// The invite link: the page anyone in the group chat answers from, with no
// app and no account. Rendered on the server and complete without script;
// the script only makes the calendar quicker. A budget is shown to nobody
// but the person who gave it, on their own page.

export type InviteOptions = {
  // Where the links point when set; otherwise the origin of whichever request
  // asks for one, an invite page or an API call.
  publicUrl?: string;
  // Where an invitee can get the app; no button without it.
  appStoreUrl?: string;
  // The Apple team the iOS app is signed with; iOS opens the links in the
  // app only once it is named.
  appleTeamId?: string;
};

type Html = HtmlEscapedString | Promise<HtmlEscapedString>;
type Issues = Partial<Record<string, string>>;

const maxResponses = 100;
const tokenDays = 180;
// mobile/app.json, ios.bundleIdentifier.
const bundleId = "ca.circles.app";

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(24).toString("base64url");

// Where the links point: PUBLIC_URL when set, else the request's own origin
// with the scheme the proxy that ended TLS, if any, says the request had.
export function originOf(options: InviteOptions, c: Context): string {
  if (options.publicUrl) return options.publicUrl.replace(/\/$/, "");
  const url = new URL(c.req.url);
  const proto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto === "http" || proto === "https") url.protocol = `${proto}:`;
  return url.origin;
}

// A response is reached by the token its browser got when it was made, or
// by the one the app last asked for.
async function responseByToken(
  db: Db,
  eventId: string,
  token: string | undefined,
): Promise<ResponseRow | undefined> {
  if (!token) return undefined;
  const [row] = await db.query<ResponseRow>(
    `select ${responseColumns} from responses
     where event_id = $1 and (token_hash = $2 or link_token_hash = $2)`,
    [eventId, hash(token)],
  );
  return row;
}

const bump = (tx: Tx, eventId: string) =>
  tx.query("update events set version = version + 1 where id = $1", [eventId]);

// Names match give or take case and spacing: the only identity an invitee has.
const nameKey = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

// Someone already in under this name, the first if there are several. Only a
// row no account holds can be it: a row claimed in the app, the organizer's
// included, has an identity beyond its name, and a web visitor must not
// become them.
async function sameNamed(
  db: Db,
  event: EventRow,
  name: string,
): Promise<{ id: string; name: string } | undefined> {
  const rows = await db.query<{ id: string; name: string }>(
    `select id, name from responses
     where event_id = $1 and attending and account_id is null
     order by created_at`,
    [event.id],
  );
  const key = nameKey(name);
  return rows.find((row) => nameKey(row.name) === key);
}

// Form reading

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};
const fields = (form: FormData, name: string) =>
  form.getAll(name).filter((v): v is string => typeof v === "string");

type Rsvp = { attending: boolean; name?: string };

// The name and the answer to "Can you make it?". Someone already known may
// leave the name out and keep the one they gave.
function rsvpFrom(
  form: FormData,
  existing: ResponseRow | undefined,
): { rsvp?: Rsvp; name: string; issues: Issues } {
  const issues: Issues = {};
  const said = field(form, "attending");
  const attending = said === "in" ? true : said === "out" ? false : undefined;
  if (attending === undefined) issues.attending = "Say whether you can make it";
  const typed = form.get("name");
  let name: string | undefined;
  if (typeof typed === "string" || !existing) {
    const parsed = DisplayName.safeParse(
      typeof typed === "string" ? typed : "",
    );
    if (parsed.success) name = parsed.data;
    else issues.name = parsed.error.issues[0]?.message ?? "Enter a name";
  }
  const ok = attending !== undefined && Object.keys(issues).length === 0;
  return {
    rsvp: ok ? { attending, name } : undefined,
    name: typeof typed === "string" ? typed : "",
    issues,
  };
}

// What the questions form holds, as typed, so it can be sent back with its
// problems or opened again to change.
type FormValues = {
  days: Set<string>;
  budget: string;
  budgetOther: string;
  choices: Partial<Record<string, Set<string>>>;
  texts: Partial<Record<string, string>>;
};

function valuesOf(questions: Question[], answers: Answers | null): FormValues {
  const values: FormValues = {
    days: new Set(),
    budget: "",
    budgetOther: "",
    choices: {},
    texts: {},
  };
  for (const question of questions) {
    const answer = answers?.[question.id];
    if (!answer || answer.kind !== question.kind) continue;
    if (answer.kind === "dates")
      for (const range of answer.ranges)
        for (const day of datesIn(range.start, range.end)) values.days.add(day);
    if (answer.kind === "budget" && question.kind === "budget") {
      if (answer.max === null) values.budget = "none";
      else if (question.presets.includes(answer.max))
        values.budget = String(answer.max);
      else values.budgetOther = String(answer.max);
    }
    if (answer.kind === "choice")
      values.choices[question.id] = new Set(answer.choices);
    if (answer.kind === "text") values.texts[question.id] = answer.text;
  }
  return values;
}

// Checked days, consecutive ones joined into ranges.
function rangesOf(days: Iterable<string>): DateRange[] {
  const ranges: { start: string; end: string }[] = [];
  for (const day of [...new Set(days)].sort()) {
    const last = ranges.at(-1);
    if (last && addDays(last.end, 1) === day) last.end = day;
    else ranges.push({ start: day, end: day });
  }
  return ranges;
}

function answersFrom(
  form: FormData,
  event: EventRow,
): { answers: Answers; values: FormValues; issues: Issues } {
  const issues: Issues = {};
  const values: FormValues = {
    days: new Set(fields(form, "day")),
    budget: field(form, "budget"),
    budgetOther: field(form, "budgetOther").trim(),
    choices: {},
    texts: {},
  };
  const answers: Answers = {};
  for (const question of event.questions) {
    const key = `q_${question.id}`;
    switch (question.kind) {
      case "dates": {
        // The page offers only the window's days; anything else is no
        // answer, not a day to drop.
        const inWindow = new Set(datesIn(event.windowStart, event.windowEnd));
        if (![...values.days].every((day) => inWindow.has(day))) {
          issues.day = "Pick days from the calendar";
          break;
        }
        const ranges = rangesOf(values.days);
        if (ranges.length > 0) answers[question.id] = { kind: "dates", ranges };
        break;
      }
      case "budget": {
        if (values.budgetOther) {
          const amount = Number(values.budgetOther.replace(/[$,\s]/g, ""));
          if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000)
            issues.budgetOther = "Enter a whole dollar amount";
          else answers[question.id] = { kind: "budget", max: amount };
        } else if (values.budget === "none") {
          answers[question.id] = { kind: "budget", max: null };
        } else if (question.presets.includes(Number(values.budget))) {
          answers[question.id] = { kind: "budget", max: Number(values.budget) };
        }
        break;
      }
      case "choice": {
        const known = new Set(question.choices.map((c) => c.id));
        const picked = fields(form, key);
        values.choices[question.id] = new Set(picked);
        if (!picked.every((id) => known.has(id)))
          issues[key] = "Pick from the options";
        else if (picked.length > 0)
          answers[question.id] = { kind: "choice", choices: picked };
        break;
      }
      case "text": {
        const text = field(form, key).trim();
        values.texts[question.id] = text;
        if (text) answers[question.id] = { kind: "text", text };
        break;
      }
    }
  }
  const checked = Answers.safeParse(answers);
  if (!checked.success)
    for (const issue of checked.error.issues) {
      const id = String(issue.path[0]);
      const question = event.questions.find((q) => q.id === id);
      const key = question?.kind === "dates" ? "day" : `q_${id}`;
      issues[key] ??= issue.message;
    }
  return { answers, values, issues };
}

// Writes. A response sent again as it stands is not a change: it leaves the
// version, and so the itineraries, alone.

async function saveRsvp(
  db: Db,
  event: EventRow,
  existing: ResponseRow | undefined,
  token: string | undefined,
  rsvp: Rsvp,
): Promise<{ token: string } | { full: true }> {
  return db.transaction(async (tx) => {
    if (existing && token) {
      if (
        existing.attending === rsvp.attending &&
        (rsvp.name === undefined || rsvp.name === existing.name)
      )
        return { token };
      await tx.query(
        `update responses set attending = $2, name = coalesce($3::text, name)
           where id = $1`,
        [existing.id, rsvp.attending, rsvp.name ?? null],
      );
      await bump(tx, event.id);
      return { token };
    }
    const [{ count }] = await tx.query<{ count: number }>(
      "select count(*)::int as count from responses where event_id = $1",
      [event.id],
    );
    if (count >= maxResponses) return { full: true as const };
    const fresh = newToken();
    await tx.query(
      `insert into responses (event_id, token_hash, name, attending)
       values ($1, $2, $3, $4)`,
      [event.id, hash(fresh), rsvp.name!, rsvp.attending],
    );
    await bump(tx, event.id);
    return { token: fresh };
  });
}

// This browser becomes the one that opens an existing response: a fresh
// token replaces the one the browser that made it holds, so that browser is
// asked the same question next time, and the row stays one person. The
// answers do not come along: a first name is all anyone with the link needs
// to say "That's me", so they must not read back what the first browser
// said, budget least of all. The row counts as unanswered until this
// browser answers, which also marks the options stale.
async function takeOver(
  db: Db,
  event: EventRow,
  twin: { id: string },
  attending: boolean,
): Promise<string> {
  const fresh = newToken();
  await db.transaction(async (tx) => {
    await tx.query(
      `update responses
         set token_hash = $2, attending = $3, answers = null
       where id = $1`,
      [twin.id, hash(fresh), attending],
    );
    await bump(tx, event.id);
  });
  return fresh;
}

async function saveAnswers(
  db: Db,
  event: EventRow,
  response: ResponseRow,
  answers: Answers,
) {
  if (isDeepStrictEqual(response.answers, answers)) return;
  await db.transaction(async (tx) => {
    await tx.query("update responses set answers = $2::jsonb where id = $1", [
      response.id,
      JSON.stringify(answers),
    ]);
    await bump(tx, event.id);
  });
}

// Markup

const icon = (paths: string, strokeWidth = 1.75) =>
  raw(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`,
  );
const markIcon = icon(
  '<circle cx="9" cy="12" r="6.5"/><circle cx="15" cy="12" r="6.5"/>',
  2,
);
const calendarIcon = icon(
  '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
);
const lockIcon = icon(
  '<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
);
const checkIcon = icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.5);
const leftIcon = icon('<path d="M14.5 6l-6 6 6 6"/>', 2);
const rightIcon = icon('<path d="M9.5 6l6 6-6 6"/>', 2);

const css = raw(`
*,*::before,*::after{box-sizing:border-box}
:root{color-scheme:light;--fg:#0a0a0a;--muted:#737373;--sec:#f5f5f5;--line:#e5e5e5;--pri:#171717;--pri-fg:#fafafa;--bg:#fff;--err:#b42318;--ease:cubic-bezier(.2,.8,.2,1)}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:400 15px/22px Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased;accent-color:var(--fg)}
::selection{background:var(--fg);color:var(--bg)}
main{max-width:430px;margin:0 auto;padding:16px 20px 48px}
h1,h2,p,dl{margin:0}
fieldset{border:0;padding:0;margin:0;min-width:0}
legend{display:block;padding:0}
.brand{display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:28px}
.brand svg{width:20px;height:20px}
.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.invited{color:var(--muted);margin-bottom:2px}
h1{font-size:34px;line-height:40px;font-weight:600;letter-spacing:-.8px;text-wrap:balance}
.when{display:flex;align-items:center;gap:6px;color:var(--muted);margin-top:8px}
.when svg,.hl svg{width:16px;height:16px;flex:none}
.hl{font-size:17px;line-height:22px;font-weight:600;letter-spacing:-.4px;display:flex;align-items:center;gap:6px}
.hl svg{color:var(--muted)}
.lbl{display:block;font-weight:600;line-height:20px}
.hint{color:var(--muted);margin-top:4px}
.fld{display:block;width:100%;min-height:44px;padding:11px 16px;background:var(--sec);border:1px solid transparent;border-radius:12px;font:inherit;color:inherit;caret-color:var(--fg);-webkit-appearance:none;appearance:none}
.fld::placeholder{color:var(--muted);opacity:1}
.fld:focus-visible{outline:none;border-color:var(--fg)}
.fld[aria-invalid=true]{border-color:var(--err)}
.ta{min-height:96px;resize:vertical}
.btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:44px;padding:0 20px;border-radius:999px;border:1px solid var(--fg);background:var(--bg);color:var(--fg);font:inherit;font-weight:500;text-decoration:none;cursor:pointer;transition:transform .15s var(--ease)}
.btn.primary{background:var(--pri);border-color:var(--pri);color:var(--pri-fg)}
.btn:active{transform:scale(.98)}
.btn:focus-visible{outline:2px solid var(--fg);outline-offset:2px}
.btn svg{width:16px;height:16px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rsvp{display:grid;gap:10px;margin-top:28px}
.rsvp .hl{margin-top:18px}
.note{color:var(--muted);font-size:13px;line-height:18px;margin-top:4px}
.err{color:var(--err);font-size:13px;line-height:18px;margin-top:-2px}
.rule{border:0;border-top:1px solid var(--line);margin:28px 0 0}
.q{margin-top:28px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.chip{position:relative}
.chip input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}
.chip span{display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:var(--bg);font-weight:500;font-size:14px}
.chip input:checked+span{background:var(--pri);color:var(--pri-fg);border-color:var(--pri)}
.chip input:focus-visible+span{outline:2px solid var(--fg);outline-offset:2px}
.chips+.fld{margin-top:12px}
.rows{display:grid;gap:8px;margin-top:12px}
.row{position:relative;display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--sec);border:1.5px solid transparent;border-radius:14px;cursor:pointer}
.row input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}
.row:has(input:checked){border-color:var(--fg)}
.rt{flex:1;min-width:0;display:grid}
.rl{font-weight:500}
.rd{color:var(--muted);font-size:13px;line-height:18px}
.rc{flex:none;width:22px;height:22px;border-radius:50%;background:var(--bg);border:1px solid var(--line);display:grid;place-items:center;color:var(--pri-fg)}
.rc svg{width:12px;height:12px;opacity:0}
.row input:checked~.rc{background:var(--pri);border-color:var(--pri)}
.row input:checked~.rc svg{opacity:1}
.row input:focus-visible~.rc{outline:2px solid var(--fg);outline-offset:2px}
.cal{margin-top:12px;border:1px solid var(--line);border-radius:16px;padding:14px 12px 12px}
.month+.month{margin-top:16px;padding-top:16px;border-top:1px solid var(--line)}
.month[hidden]{display:none}
.mh{display:flex;align-items:center;justify-content:space-between;padding:0 4px 10px}
.mn{font-weight:600;font-size:16px;letter-spacing:-.3px}
.pager{display:flex;gap:6px}
.pager[hidden]{display:none}
.pager button{width:28px;height:28px;padding:0;border-radius:50%;border:1px solid var(--line);background:var(--bg);color:var(--fg);display:grid;place-items:center;cursor:pointer}
.pager button:disabled{opacity:.35;cursor:default}
.pager svg{width:14px;height:14px}
.wk,.grid{display:grid;grid-template-columns:repeat(7,1fr)}
.wk span{text-align:center;font-size:12px;line-height:16px;color:var(--muted);padding-bottom:6px}
.grid{row-gap:4px}
.day{position:relative;height:40px;display:grid;place-items:center;font-variant-numeric:tabular-nums}
.day.out{color:var(--muted);opacity:.4}
.day input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}
.day span{width:36px;height:36px;border-radius:50%;display:grid;place-items:center}
.day input:checked+span{background:var(--pri);color:var(--pri-fg)}
.day input:focus-visible+span{outline:2px solid var(--fg);outline-offset:1px}
@supports selector(:has(a)){
.cal .day:has(:checked)::before{content:"";position:absolute;top:2px;bottom:2px;left:var(--l,0);right:var(--r,0);background:var(--sec)}
.cal .day:has(:checked) span{position:relative;background:none;color:var(--fg)}
.cal .grid>.day:has(:checked):first-child,.cal .day:not(:has(:checked))+.day:has(:checked){--l:50%}
.cal .day:has(:checked):not(:has(+ .day :checked)){--r:50%}
.cal .grid>.day:has(:checked):first-child span,.cal .day:not(:has(:checked))+.day:has(:checked) span,.cal .day:has(:checked):not(:has(+ .day :checked)) span{background:var(--pri);color:var(--pri-fg)}
}
.ranges{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ranges[hidden]{display:none}
.rchip{display:inline-flex;align-items:center;gap:8px;min-height:32px;padding:0 10px 0 12px;border:0;border-radius:999px;background:var(--pri);color:var(--pri-fg);font:inherit;font-size:13px;font-weight:500;cursor:pointer}
.send{margin-top:28px}
.done{text-align:center;padding-top:24px}
.badge{width:64px;height:64px;border-radius:50%;background:var(--pri);color:var(--pri-fg);display:grid;place-items:center;margin:0 auto 20px}
.badge svg{width:26px;height:26px}
.sub{color:var(--muted);margin-top:8px;text-wrap:balance}
.summary{margin-top:24px;padding:16px;background:var(--sec);border-radius:16px;display:grid;gap:10px}
.summary>div{display:flex;justify-content:space-between;gap:16px}
.summary dt{color:var(--muted);flex:none}
.summary dd{margin:0;text-align:right}
.links{display:flex;justify-content:center;flex-wrap:wrap;gap:6px 20px;margin-top:16px}
.links form{display:contents}
.link{padding:0;border:0;background:none;font:inherit;font-weight:500;color:var(--fg);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--line);cursor:pointer}
.app{margin-top:40px;padding:20px;border:1px solid var(--line);border-radius:20px}
.app-mark{width:44px;height:44px;border-radius:12px;background:var(--pri);color:var(--pri-fg);display:grid;place-items:center;margin-bottom:16px}
.app-mark svg{width:24px;height:24px}
.app h2{font-size:20px;line-height:26px;font-weight:600;letter-spacing:-.4px}
.app p{color:var(--muted);margin:6px 0 16px}
.quiet{display:block;text-align:center;color:var(--muted);text-decoration:none;font-weight:500;margin-top:12px;min-height:44px;line-height:44px}
.plain{padding-top:40px}
.plain p{color:var(--muted);margin-top:8px}
`);

// Taps on the calendar fill whole ranges, show them as chips, and page the
// months. Everything it touches already works as plain checkboxes.
const script = raw(`
(function(){
var cal=document.querySelector('[data-cal]');if(!cal)return;
var months=[].slice.call(cal.querySelectorAll('.month'));
var boxes=[].slice.call(cal.querySelectorAll('input[name=day]'));
var chips=cal.querySelector('[data-ranges]');
var names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var pending=null;
function label(d){var p=d.split('-');return names[+p[1]-1]+' '+(+p[2])}
function text(a,b){if(a===b)return label(a);var p=a.split('-'),q=b.split('-');return p[1]===q[1]?label(a)+' \\u2013 '+(+q[2]):label(a)+' \\u2013 '+label(b)}
function next(d){var t=new Date(d+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+1);return t.toISOString().slice(0,10)}
function ranges(){var out=[];boxes.forEach(function(b){if(!b.checked)return;var last=out[out.length-1];if(last&&next(last.end)===b.value)last.end=b.value;else out.push({start:b.value,end:b.value})});return out}
function draw(){var rs=ranges();chips.hidden=rs.length===0;chips.textContent='';rs.forEach(function(r){var btn=document.createElement('button');btn.type='button';btn.className='rchip';btn.setAttribute('aria-label','Remove '+text(r.start,r.end));btn.appendChild(document.createTextNode(text(r.start,r.end)));var x=document.createElement('span');x.setAttribute('aria-hidden','true');x.textContent='\\u00d7';btn.appendChild(x);btn.addEventListener('click',function(){boxes.forEach(function(b){if(b.value>=r.start&&b.value<=r.end)b.checked=false});pending=null;draw()});chips.appendChild(btn)})}
boxes.forEach(function(b){b.addEventListener('change',function(){if(b.checked&&pending&&pending!==b.value){var lo=pending<b.value?pending:b.value,hi=pending<b.value?b.value:pending;boxes.forEach(function(o){if(o.value>=lo&&o.value<=hi)o.checked=true});pending=null}else pending=b.checked?b.value:null;draw()})});
if(months.length>1){var at=0;var show=function(n){at=n;months.forEach(function(m,k){m.hidden=k!==n;var pg=m.querySelector('.pager');if(!pg)return;pg.hidden=false;pg.querySelector('[data-prev]').disabled=n===0;pg.querySelector('[data-next]').disabled=n===months.length-1})};
months.forEach(function(m){var p=m.querySelector('[data-prev]'),n=m.querySelector('[data-next]');if(p)p.addEventListener('click',function(){show(at-1)});if(n)n.addEventListener('click',function(){show(at+1)})});
var first=0;months.some(function(m,k){if(m.querySelector('input:checked')){first=k;return true}});show(first)}
draw();
})();
`);

// A link opened with its token in the query is shown without it, so the
// token stays out of the address bar, the history and the share sheet.
const forgetToken = raw(
  `if(location.search.includes("g="))history.replaceState(null,"",location.pathname+(location.search.includes("edit")?"?edit":""));`,
);

const brand = html`<div class="brand">${markIcon}<span>Circles</span></div>`;

// The document around every page.
function skeleton(
  title: string,
  head: Html | "",
  content: Html,
  scripts: HtmlEscapedString[],
) {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#ffffff" />
        <title>${title} · Circles</title>
        ${head}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
        />
        <style>
          ${css}
        </style>
      </head>
      <body>
        <main>${brand}${content}</main>
        ${scripts.map(
          (code) =>
            html`<script>
              ${code};
            </script>`,
        )}
      </body>
    </html>`;
}

function page(
  event: EventRow,
  origin: string,
  content: Html,
  scripts: HtmlEscapedString[] = [],
) {
  const url = `${origin}/i/${event.slug}`;
  const when = approxRange(event.windowStart, event.windowEnd);
  const head = html`<meta property="og:type" content="website" />
    <meta property="og:site_name" content="Circles" />
    <meta property="og:title" content="${event.title} · ${when}" />
    <meta
      property="og:description"
      content="Can you make it? Answer in a minute, no app needed."
    />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${url}/preview.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="${origin}/i/icon.png" />`;
  return skeleton(event.title, head, content, scripts);
}

// A page with nothing to preview: a dead link, a full event.
function plainPage(heading: string, line: string) {
  return skeleton(
    heading,
    "",
    html`<div class="plain">
      <h1>${heading}</h1>
      <p>${line}</p>
    </div>`,
    [],
  );
}

// Once the window has passed there is nothing left to answer.
const endedPage = (event: EventRow) =>
  plainPage(
    "This event has ended",
    `${event.title}, ${approxRange(event.windowStart, event.windowEnd, true)}`,
  );

const error = (message: string | undefined, id: string) =>
  message ? html`<p class="err" id="${id}">${message}</p>` : "";

function header(event: EventRow) {
  return html`<header>
    <p class="invited">${event.organizer.name} invited you to</p>
    <h1>${event.title}</h1>
    <p class="when">
      ${calendarIcon}<span
        >${approxRange(event.windowStart, event.windowEnd)}</span
      >
    </p>
  </header>`;
}

// The name and the two answers: the whole page for someone new, the top of
// the questions page for someone who is in.
function rsvpForm(
  event: EventRow,
  response: ResponseRow | undefined,
  name: string,
  issues: Issues,
) {
  const isIn = response?.attending === true;
  return html`<form method="post" action="/i/${event.slug}" class="rsvp">
    <label class="lbl" for="name">Your name</label>
    <input
      class="fld"
      id="name"
      type="text"
      name="name"
      value="${name}"
      placeholder="First name"
      maxlength="40"
      autocomplete="given-name"
      autocapitalize="words"
      required
      ${issues.name ? raw('aria-invalid="true" aria-describedby="name-err"') : ""}
    />
    ${error(issues.name, "name-err")}
    <h2 class="hl" id="attending-lbl">Can you make it?</h2>
    <button
      type="submit"
      name="attending"
      value="in"
      class="vh"
      tabindex="-1"
      aria-hidden="true"
    ></button>
    <div class="pair" role="group" aria-labelledby="attending-lbl">
      <button class="btn" type="submit" name="attending" value="out">
        Can't make it
      </button>
      <button
        class="btn primary"
        type="submit"
        name="attending"
        value="in"
        ${isIn ? raw('aria-pressed="true"') : ""}
      >
        ${isIn ? checkIcon : ""}I'm in
      </button>
    </div>
    ${error(issues.attending, "attending-err")}
    ${
      response
        ? ""
        : html`<p class="note">
            Takes about a minute. No app or account needed.
          </p>`
    }
  </form>`;
}

const monthName = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const pad = (n: number) => String(n).padStart(2, "0");

// One grid per month in the window. Every day of the window is a checkbox,
// checked when it is one of the given free days; the month's other days are
// shown but can't be picked. The styles join checked neighbours into a band.
function calendar(event: EventRow, days: Set<string>) {
  const inWindow = new Set(datesIn(event.windowStart, event.windowEnd));
  const months = [...new Set([...inWindow].map((d) => d.slice(0, 7)))];
  return months.map((ym) => {
    const [year, month] = ym.split("-").map(Number) as [number, number];
    const first = weekdayOf(`${ym}-01`);
    const count = lastDayOf(year, month);
    const cells = [
      ...Array.from(
        { length: first },
        () => html`<span class="day off" aria-hidden="true"></span>`,
      ),
      ...Array.from({ length: count }, (_, i) => {
        const date = `${ym}-${pad(i + 1)}`;
        if (!inWindow.has(date))
          return html`<span class="day out" aria-hidden="true">${i + 1}</span>`;
        return html`<label class="day">
          <input
            type="checkbox"
            name="day"
            value="${date}"
            aria-label="${dayRange(date, date)}"
            ${days.has(date) ? raw("checked") : ""}
          />
          <span>${i + 1}</span>
        </label>`;
      }),
    ];
    return html`<div class="month">
      <div class="mh">
        <span class="mn"
          >${monthName.format(new Date(`${ym}-01T00:00:00Z`))}</span
        >
        <span class="pager" hidden>
          <button type="button" data-prev aria-label="Previous month">
            ${leftIcon}
          </button>
          <button type="button" data-next aria-label="Next month">
            ${rightIcon}
          </button>
        </span>
      </div>
      <div class="wk" aria-hidden="true">
        ${["S", "M", "T", "W", "T", "F", "S"].map((d) => html`<span>${d}</span>`)}
      </div>
      <div class="grid">${cells}</div>
    </div>`;
  });
}

function questionCard(
  question: Question,
  event: EventRow,
  values: FormValues,
  issues: Issues,
) {
  const key = `q_${question.id}`;
  const hint = question.hint
    ? html`<p class="hint" id="${key}-hint">${question.hint}</p>`
    : "";
  switch (question.kind) {
    case "dates":
      return html`<fieldset class="q">
        <legend><span class="hl">${question.title}</span></legend>
        ${hint} ${error(issues.day, "day-err")}
        <div class="cal" data-cal>
          ${calendar(event, values.days)}
          <div class="ranges" data-ranges hidden></div>
        </div>
      </fieldset>`;
    case "budget":
      return html`<fieldset class="q">
        <legend>
          <span class="hl"
            >${question.title}${lockIcon}<span class="vh">Private</span></span
          >
        </legend>
        ${hint}
        <div class="chips">
          ${budgetRanges(question.presets).map(
            (range) =>
              html`<label class="chip">
                <input
                  type="radio"
                  name="budget"
                  value="${range.max ?? "none"}"
                  ${values.budget === String(range.max ?? "none") ? raw("checked") : ""}
                />
                <span>${range.label}</span>
              </label>`,
          )}
        </div>
        <input
          class="fld"
          type="text"
          inputmode="numeric"
          name="budgetOther"
          value="${values.budgetOther}"
          placeholder="Other amount, e.g. $450"
          aria-label="Other amount"
          ${issues.budgetOther ? raw('aria-invalid="true" aria-describedby="budgetOther-err"') : ""}
        />
        ${error(issues.budgetOther, "budgetOther-err")}
      </fieldset>`;
    case "choice":
      return html`<fieldset class="q">
        <legend><span class="hl">${question.title}</span></legend>
        ${hint} ${error(issues[key], `${key}-err`)}
        <div class="rows">
          ${question.choices.map(
            (choice) =>
              html`<label class="row">
                <input
                  type="checkbox"
                  name="${key}"
                  value="${choice.id}"
                  ${values.choices[question.id]?.has(choice.id) ? raw("checked") : ""}
                />
                <span class="rt">
                  <span class="rl">${choice.label}</span>
                  ${choice.detail ? html`<span class="rd">${choice.detail}</span>` : ""}
                </span>
                <span class="rc">${checkIcon}</span>
              </label>`,
          )}
        </div>
      </fieldset>`;
    case "text":
      return html`<div class="q">
        <label class="hl" for="${key}">${question.title}</label>
        ${hint}
        <textarea
          class="fld ta"
          id="${key}"
          name="${key}"
          rows="3"
          maxlength="500"
          ${question.hint ? raw(`aria-describedby="${key}-hint"`) : ""}
          ${issues[key] ? raw('aria-invalid="true"') : ""}
        >
${values.texts[question.id] ?? ""}</textarea>
        ${error(issues[key], `${key}-err`)}
      </div>`;
  }
}

function questionsPage(
  event: EventRow,
  response: ResponseRow,
  values: FormValues,
  issues: Issues,
  rsvpIssues: Issues = {},
  name = response.name,
) {
  return html`${header(event)}${rsvpForm(event, response, name, rsvpIssues)}
    <hr class="rule" />
    <form method="post" action="/i/${event.slug}" id="answers">
      <input type="hidden" name="answers" value="1" />
      ${event.questions.map((q) => questionCard(q, event, values, issues))}
      <button class="btn primary send" type="submit">Send my answers</button>
    </form>`;
}

// With a store to send people to, the card sells the app; without one, it
// only opens the app for someone who already has it.
function appCard(event: EventRow, token: string, options: InviteOptions) {
  // A Universal Link: the app where it is installed and iOS hands the link
  // over, this page again anywhere else.
  // The app's own scheme: a Universal Link to this same site stays in the
  // browser by Apple's rule, so only the scheme opens an installed app here.
  const open = `circles://invite?slug=${event.slug}&g=${encodeURIComponent(token)}`;
  return html`<aside class="app">
    <div class="app-mark">${markIcon}</div>
    ${
      options.appStoreUrl
        ? html`<h2>Get the Circles app</h2>
            <p>See this plan and your other events in one place.</p>
            <a class="btn primary" href="${options.appStoreUrl}">Get the app</a>
            <a class="quiet" href="${open}">Open in the app</a>`
        : html`<a class="btn primary" href="${open}">Open in the app</a>`
    }
  </aside>`;
}

function donePage(
  event: EventRow,
  response: ResponseRow,
  token: string,
  options: InviteOptions,
) {
  const lines = answerLines(event.questions, response.answers ?? {});
  // answerLines leaves the budget out; the summary says one was given.
  const budget = event.questions.find((q) => q.kind === "budget");
  const gaveBudget =
    budget !== undefined && response.answers?.[budget.id]?.kind === "budget";
  return html`<header class="done">
      <div class="badge">${checkIcon}</div>
      <h1>You're all set!</h1>
      <p class="sub">${event.organizer.name} can see you're in.</p>
    </header>
    ${
      lines.length > 0 || gaveBudget
        ? html`<dl class="summary">
            ${lines.map(
              (line) =>
                html`<div>
                  <dt>${line.title}</dt>
                  <dd>${line.text}</dd>
                </div>`,
            )}
            ${
              gaveBudget
                ? html`<div>
                    <dt>Budget</dt>
                    <dd>Private</dd>
                  </div>`
                : ""
            }
          </dl>`
        : ""
    }
    <div class="links">
      ${
        event.questions.length > 0
          ? html`<a class="link" href="/i/${event.slug}?edit"
              >Change answers</a
            >`
          : ""
      }
      <form method="post" action="/i/${event.slug}">
        <button class="link" type="submit" name="attending" value="out">
          Can't make it after all
        </button>
      </form>
    </div>
    ${appCard(event, token, options)}`;
}

function declinedPage(event: EventRow, token: string, options: InviteOptions) {
  return html`<header>
      <h1>No worries</h1>
      <p class="sub">${event.organizer.name} can see you can't make it.</p>
    </header>
    <form method="post" action="/i/${event.slug}" class="rsvp">
      <button class="btn" type="submit" name="attending" value="in">
        Changed my mind, I'm in
      </button>
    </form>
    ${appCard(event, token, options)}`;
}

const rsvpPage = (event: EventRow, name: string, issues: Issues) =>
  html`${header(event)}${rsvpForm(event, undefined, name, issues)}`;

// The name is already on the list as someone who is in: the same person
// from another browser, or a second person with the name. Nothing of the
// first is shown; the answer comes back with the RSVP it interrupted.
function samePage(
  event: EventRow,
  taken: string,
  name: string,
  attending: boolean,
) {
  return html`${header(event)}
    <form method="post" action="/i/${event.slug}" class="rsvp">
      <input type="hidden" name="name" value="${name}" />
      <input
        type="hidden"
        name="attending"
        value="${attending ? "in" : "out"}"
      />
      <h2 class="hl" id="same-lbl">Someone named ${taken} is already in</h2>
      <div class="pair" role="group" aria-labelledby="same-lbl">
        <button class="btn" type="submit" name="same" value="no">
          Someone else
        </button>
        <button class="btn" type="submit" name="same" value="yes">
          That's me
        </button>
      </div>
    </form>`;
}

let iconPng: Promise<Buffer> | undefined;

// Public pages: GET/POST /i/:slug, GET /i/:slug/preview.png, GET /i/icon.png.
export function invitePages(db: Db, options: InviteOptions = {}) {
  const app = new Hono();
  const cookieName = (slug: string) => `response_${slug}`;
  const cookieOptions = (slug: string, c: Context) => ({
    path: `/i/${slug}`,
    httpOnly: true,
    sameSite: "Lax" as const,
    secure: originOf(options, c).startsWith("https:"),
    maxAge: tokenDays * 24 * 60 * 60,
  });
  const notFound = plainPage(
    "This link doesn't work",
    "Ask whoever sent it for a new one.",
  );
  const notFromPage = plainPage(
    "That didn't come from the invite page",
    "Open the link again to answer.",
  );

  // Tells iOS which app opens /i/<slug>?g=… instead of the page. A link
  // without a token stays a page: the app has no screen for it.
  if (options.appleTeamId)
    app.get("/.well-known/apple-app-site-association", (c) =>
      c.json({
        applinks: {
          details: [
            {
              appIDs: [`${options.appleTeamId}.${bundleId}`],
              // "?*" is one or more characters: a bare "*" also matches a
              // link with no g at all, which has no screen in the app.
              components: [{ "/": "/i/*", "?": { g: "?*" } }],
            },
          ],
        },
      }),
    );

  app.get("/i/icon.png", async (c) => {
    iconPng ??= readFile(new URL("../assets/icon.png", import.meta.url));
    c.header("cache-control", "public, max-age=86400");
    return c.body(new Uint8Array(await iconPng), 200, {
      "content-type": "image/png",
    });
  });

  app.get("/i/:slug/preview.png", async (c) => {
    const event = await loadEventBySlug(db, c.req.param("slug"));
    if (!event) return c.text("Not found", 404);
    const host = new URL(originOf(options, c)).host;
    const png = await previewPng(event, host);
    c.header("cache-control", "public, max-age=300");
    return c.body(png, 200, { "content-type": "image/png" });
  });

  // A link pasted with a slash on the end still opens the page; anything
  // that is not a slug goes nowhere rather than into a header.
  app.get("/i/:slug/", (c) => {
    const slug = c.req.param("slug");
    if (!/^[a-z0-9-]+$/.test(slug)) return c.html(notFound, 404);
    return c.redirect(`/i/${slug}${new URL(c.req.url).search}`, 301);
  });

  app.get("/i/:slug", async (c) => {
    const slug = c.req.param("slug");
    const event = await loadEventBySlug(db, slug);
    if (!event) return c.html(notFound, 404);
    if (hasEnded(event.windowEnd)) return c.html(endedPage(event), 410);
    const origin = originOf(options, c);
    const linked = c.req.query("g");
    const own = getCookie(c, cookieName(slug));
    const token = linked || own;
    const response = await responseByToken(db, event.id, token);
    if (!response || !token)
      return c.html(page(event, origin, rsvpPage(event, "", {})));
    // The browser keeps a cookie that already opens this response: the link's
    // token rotates, and a cookie set from it would die with the next link.
    if (
      linked &&
      (!own || (await responseByToken(db, event.id, own))?.id !== response.id)
    )
      setCookie(c, cookieName(slug), linked, cookieOptions(slug, c));
    if (!response.attending)
      return c.html(
        page(event, origin, declinedPage(event, token, options), [forgetToken]),
      );
    const asking =
      event.questions.length > 0 &&
      (response.answers === null || c.req.query("edit") !== undefined);
    if (!asking)
      return c.html(
        page(event, origin, donePage(event, response, token, options), [
          forgetToken,
        ]),
      );
    const values = valuesOf(event.questions, response.answers);
    return c.html(
      page(event, origin, questionsPage(event, response, values, {}), [
        forgetToken,
        script,
      ]),
    );
  });

  app.post("/i/:slug", async (c) => {
    const slug = c.req.param("slug");
    const event = await loadEventBySlug(db, slug);
    if (!event) return c.html(notFound, 404);
    if (hasEnded(event.windowEnd)) return c.html(endedPage(event), 410);
    const origin = originOf(options, c);
    // A form posted from another site carries its origin; the browser keeps
    // the cookie back, so taking it would hand the visitor a new response.
    const sent = c.req.header("origin");
    if (sent && sent !== origin && sent !== new URL(c.req.url).origin)
      return c.html(notFromPage, 403);
    // A body that is not a form, or text with a NUL in it (which Postgres
    // refuses), comes from no browser form.
    const form = await c.req.formData().catch(() => undefined);
    if (
      !form ||
      [...form.values()].some((v) => typeof v === "string" && v.includes("\0"))
    )
      return c.html(notFromPage, 400);
    const token = getCookie(c, cookieName(slug));
    const response = await responseByToken(db, event.id, token);

    if (form.has("answers")) {
      if (!response || !token || !response.attending)
        return c.redirect(`/i/${slug}`, 303);
      const { answers, values, issues } = answersFrom(form, event);
      if (Object.keys(issues).length > 0)
        return c.html(
          page(event, origin, questionsPage(event, response, values, issues), [
            script,
          ]),
          400,
        );
      await saveAnswers(db, event, response, answers);
      return c.redirect(`/i/${slug}`, 303);
    }

    const { rsvp, name, issues } = rsvpFrom(form, response);
    if (!rsvp) {
      const content =
        response && token && response.attending
          ? questionsPage(
              event,
              response,
              valuesOf(event.questions, response.answers),
              {},
              issues,
              name,
            )
          : rsvpPage(event, name, issues);
      return c.html(
        page(event, origin, content, response ? [script] : []),
        400,
      );
    }
    if (!response) {
      // A name already in, from a browser that knows no response here: asked
      // once whether it is the same person; the answer rides on the form.
      const twin = await sameNamed(db, event, rsvp.name!);
      const same = field(form, "same");
      if (twin && same !== "yes" && same !== "no")
        return c.html(
          page(
            event,
            origin,
            samePage(event, twin.name, rsvp.name!, rsvp.attending),
          ),
        );
      if (twin && same === "yes") {
        const fresh = await takeOver(db, event, twin, rsvp.attending);
        setCookie(c, cookieName(slug), fresh, cookieOptions(slug, c));
        return c.redirect(`/i/${slug}`, 303);
      }
    }
    const saved = await saveRsvp(db, event, response, token, rsvp);
    if ("full" in saved)
      return c.html(
        plainPage("This event is full", "It can't take any more answers."),
        409,
      );
    setCookie(c, cookieName(slug), saved.token, cookieOptions(slug, c));
    return c.redirect(`/i/${slug}`, 303);
  });

  return app;
}

// Signed-in routes under /api: POST /invites/:slug/claim and
// POST /events/:eventId/answers-link.
export function inviteClaims(db: Db, options: InviteOptions = {}) {
  const app = new Hono<AppEnv>();

  // The account that opened the link it answered from takes that response
  // as its own, under the name it gave there.
  app.post("/invites/:slug/claim", async (c) => {
    const accountId = account(c);
    const { token } = await body(c, ClaimInvite);
    const event = await loadEventBySlug(db, c.req.param("slug"));
    const response = event && (await responseByToken(db, event.id, token));
    if (!event || !response)
      throw new HTTPException(404, { message: "Invite not found" });
    if (response.accountId && response.accountId !== accountId)
      throw new HTTPException(409, { message: "Someone else claimed this" });
    if (!response.accountId)
      await db.transaction(async (tx) => {
        const [mine] = await tx.query(
          "select 1 from responses where event_id = $1 and account_id = $2",
          [event.id, accountId],
        );
        if (mine)
          throw new HTTPException(409, {
            message: "You already answered this one",
          });
        // Still unclaimed, or another claim got in first.
        const [claimed] = await tx.query(
          `update responses set account_id = $2
           where id = $1 and (account_id is null or account_id = $2) returning id`,
          [response.id, accountId],
        );
        if (!claimed)
          throw new HTTPException(409, {
            message: "Someone else claimed this",
          });
        // No answer changed hands, so the itineraries stand as they are.
        await tx.query(
          "update accounts set display_name = coalesce(display_name, $2) where id = $1",
          [accountId, response.name],
        );
      });
    return c.json({ eventId: event.id } satisfies ClaimResult);
  });

  // Where someone signed in answers the questions: a fresh link to their
  // own response. The previous link from here stops working; the token
  // their browser holds from answering the invite link is untouched.
  app.post("/events/:eventId/answers-link", async (c) => {
    const accountId = account(c);
    const event = await requireEvent(db, c.req.param("eventId"));
    const token = newToken();
    const [mine] = await db.query(
      `update responses set link_token_hash = $3
       where event_id = $1 and account_id = $2 returning id`,
      [event.id, accountId, hash(token)],
    );
    if (!mine) throw new HTTPException(403, { message: "Not yours to answer" });
    const url = `${originOf(options, c)}/i/${event.slug}?g=${token}`;
    return c.json({ url } satisfies AnswersLink);
  });

  return app;
}
