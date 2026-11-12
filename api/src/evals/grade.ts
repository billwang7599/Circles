import {
  addDays,
  Answers as AnswersSchema,
  CreateEvent,
  daysBetween,
  maxQuestions,
  maxWindowDays,
  newId,
  Questions,
  ReadDates,
  type Answers,
  type DateWindow,
  type Question,
} from "@circles/shared";
import { readDates } from "../plan/dates.ts";
import {
  checkDays,
  daysInput,
  itineraryFacts,
  itineraryInput,
  makeItineraries,
  mentionsMoney,
  writeDays,
  type ItineraryBody,
} from "../plan/itinerary.ts";
import type { Model } from "../plan/model.ts";
import type { Models } from "../plan/models.ts";
import { setupEvent, titleFrom, withoutFoodQuestions } from "../plan/setup.ts";
import type { Scenario } from "./scenarios.ts";

// Runs one scenario through the planner's three model calls, the way the
// routes do, and grades what came back in code. A hard finding breaks a rule
// code guarantees whatever the model answers (a budget in the prompt, money
// in a card, a day out of order), so any at all is a bug in the planner. The
// rest are the scenario's labels: how good the model's answer was.

export type Stage = "setup" | "dates" | "itineraries";
export const stages: Stage[] = ["setup", "dates", "itineraries"];

export type Finding = {
  stage: Stage;
  hard: boolean;
  rule: string;
  detail: string;
};

export type Graded = {
  scenario: string;
  findings: Finding[];
  // How many labels each stage checked, hard rules aside.
  labels: Partial<Record<Stage, number>>;
  // What the model made, for whoever reads the run.
  setup?: { title: string; questions: string[] };
  dates?: DateWindow | null;
  itineraries?: {
    maker: "model" | "code";
    attempt: number;
    problems: string[];
    options: ItineraryBody[];
  };
  inputTokens: number;
  outputTokens: number;
};

// The event's questions as the setup would have left them: a dates and a
// budget question unless the scenario rules them out, the choice question
// when there is one, and the open one.
export function questionsOf(s: Scenario): Question[] {
  const questions: Question[] = [];
  if (!s.noDates)
    questions.push({
      kind: "dates",
      id: newId(),
      title: "Which days work for you?",
      hint: "",
    });
  if (!s.noBudget)
    questions.push({
      kind: "budget",
      id: newId(),
      title: "Max you'd spend",
      hint: "Per person, for the whole plan",
      presets: s.presets ?? [100, 250, 500],
    });
  if (s.choice)
    questions.push({
      kind: "choice",
      id: newId(),
      title: s.choice.title,
      hint: "",
      choices: s.choice.choices.map((c) => ({ id: newId(), ...c })),
    });
  questions.push({
    kind: "text",
    id: newId(),
    title: "Anything else?",
    hint: "",
  });
  return questions;
}

// One entry per reply, null for someone in who has answered nothing.
export function answersOf(
  s: Scenario,
  questions: Question[],
): (Answers | null)[] {
  return s.replies.map((reply) => {
    if (
      !reply.days &&
      reply.budget === undefined &&
      !reply.picks &&
      !reply.note
    )
      return null;
    const answers: Answers = {};
    for (const q of questions) {
      if (q.kind === "dates" && reply.days)
        answers[q.id] = {
          kind: "dates",
          ranges: reply.days.map(([from, to]) => ({
            start: addDays(s.window.windowStart, from),
            end: addDays(s.window.windowStart, to),
          })),
        };
      if (q.kind === "budget" && reply.budget !== undefined)
        answers[q.id] = { kind: "budget", max: reply.budget };
      if (q.kind === "choice" && reply.picks)
        answers[q.id] = {
          kind: "choice",
          choices: reply.picks.map((i) => q.choices[i]?.id ?? `missing-${i}`),
        };
      if (q.kind === "text" && reply.note)
        answers[q.id] = { kind: "text", text: reply.note };
    }
    return answers;
  });
}

// What is wrong with a scenario itself: labels and answers that the shared
// schemas or the window would refuse. Empty for a sound one.
export function scenarioProblems(s: Scenario): string[] {
  const problems: string[] = [];
  const refused = (
    what: string,
    result: { success: boolean; error?: { issues: { message: string }[] } },
  ) => {
    if (!result.success)
      problems.push(
        `${what}: ${result.error?.issues.map((i) => i.message).join("; ")}`,
      );
  };
  refused(
    "event",
    CreateEvent.safeParse({ description: s.description, ...s.window }),
  );
  refused("when", ReadDates.safeParse({ text: s.when, today: s.today }));
  const questions = questionsOf(s);
  refused("questions", Questions.safeParse(questions));
  for (const answers of answersOf(s, questions))
    if (answers) refused("answers", AnswersSchema.safeParse(answers));
  const span = daysBetween(s.window.windowStart, s.window.windowEnd);
  if (s.today > s.window.windowStart)
    problems.push("the window starts before today");
  const names = s.replies.map((r) => r.name);
  if (new Set(names).size !== names.length)
    problems.push("two replies share a name");
  if (s.replies.length < 2) problems.push("two people must be in");
  for (const reply of s.replies) {
    for (const [from, to] of reply.days ?? [])
      if (from < 0 || to > span || from > to)
        problems.push(
          `${reply.name}'s days ${from} to ${to} fall outside the window`,
        );
    for (const pick of reply.picks ?? [])
      if (!s.choice || pick >= s.choice.choices.length)
        problems.push(`${reply.name} picks choice ${pick}, which there is not`);
  }
  if (s.expect.topSlot) {
    const [from, to] = s.expect.topSlot;
    if (from < 0 || to > span || from > to)
      problems.push("topSlot falls outside the window");
  }
  return problems;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whether a name or number stands on its own in the text, in any script.
const hasWord = (text: string, word: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`, "iu").test(
    text,
  );

const amountWords = /\$\s?\d|\b\d+\s?(dollars|bucks)\b/i;

// A word where a venue should be.
const genericPlace =
  /^(the\s+)?(home|house|hotel|airbnb|cottage|cabin|town|city|downtown|restaurant|bar|cafe|café|gym|park|beach|lake|trail|venue|tbd|various)$|^chez\b|'s (home|house|place)$/i;

type Stagelet = Omit<
  Graded,
  "scenario" | "labels" | "inputTokens" | "outputTokens"
> & {
  labels: number;
  inputTokens?: number;
  outputTokens?: number;
};

class Sheet {
  findings: Finding[] = [];
  labels = 0;
  stage: Stage;
  constructor(stage: Stage) {
    this.stage = stage;
  }
  hard(rule: string, detail: string) {
    this.findings.push({ stage: this.stage, hard: true, rule, detail });
  }
  label(rule: string, ok: boolean, detail: string) {
    this.labels += 1;
    if (!ok)
      this.findings.push({ stage: this.stage, hard: false, rule, detail });
  }
}

// setupEvent and readDates return only what they read, so the tokens their
// round trips cost are counted on the way through the model.
function metered<I>(model: Model<I>) {
  const used = { inputTokens: 0, outputTokens: 0 };
  const meter: Model<I> = {
    model: model.model,
    async fn(input, rejected) {
      const response = await model.fn(input, rejected);
      used.inputTokens += response.inputTokens;
      used.outputTokens += response.outputTokens;
      return response;
    },
  };
  return { meter, used };
}

async function gradeSetup(s: Scenario, models: Models): Promise<Stagelet> {
  const sheet = new Sheet("setup");
  const setup = metered(models.setup);
  const { title, questions } = await setupEvent(setup.meter, {
    description: s.description,
    ...s.window,
  });
  const kinds = questions.map((q) => q.kind);
  const count = (kind: Question["kind"]) =>
    kinds.filter((k) => k === kind).length;
  if (questions.length < 1 || questions.length > maxQuestions)
    sheet.hard("count", `${questions.length} questions`);
  if (count("dates") > 1 || count("budget") > 1)
    sheet.hard("one-each", kinds.join(", "));
  if (
    withoutFoodQuestions(questions, s.description).length !== questions.length
  )
    sheet.hard("food", questions.map((q) => q.title).join(" | "));
  const texts = [
    title,
    ...questions.flatMap((q) => [
      q.title,
      q.hint,
      ...(q.kind === "choice"
        ? q.choices.flatMap((c) => [c.label, c.detail])
        : []),
    ]),
  ];
  const amounts = texts.filter((t) => amountWords.test(t));
  sheet.label("no-amounts", amounts.length === 0, amounts.join(" | "));
  const named = s.replies
    .map((r) => r.name)
    .filter((name) => texts.some((t) => hasWord(t, name)));
  sheet.label("no-names", named.length === 0, named.join(", "));
  sheet.label(
    "asks-dates",
    count("dates") === (s.noDates ? 0 : 1),
    kinds.join(", "),
  );
  if (s.expect.asksChoice !== undefined)
    sheet.label(
      "asks-choice",
      count("choice") > 0 === s.expect.asksChoice,
      kinds.join(", "),
    );
  return {
    findings: sheet.findings,
    labels: sheet.labels,
    setup: { title, questions: questions.map((q) => `${q.kind}: ${q.title}`) },
    ...setup.used,
  };
}

async function gradeDates(s: Scenario, models: Models): Promise<Stagelet> {
  const sheet = new Sheet("dates");
  // The pilot is in Toronto, so its holidays are Canada's.
  const dates = metered(models.dates);
  const read = await readDates(dates.meter, {
    text: s.when,
    today: s.today,
    timezone: "America/Toronto",
  });
  if (
    read &&
    (read.windowStart > read.windowEnd ||
      daysBetween(read.windowStart, read.windowEnd) > maxWindowDays)
  )
    sheet.hard("window", `${read.windowStart} to ${read.windowEnd}`);
  sheet.label(
    "dates",
    read?.windowStart === s.window.windowStart &&
      read?.windowEnd === s.window.windowEnd,
    read ? `read ${read.windowStart} to ${read.windowEnd}` : "read nothing",
  );
  return {
    findings: sheet.findings,
    labels: sheet.labels,
    dates: read ?? null,
    ...dates.used,
  };
}

async function gradeItineraries(
  s: Scenario,
  models: Models,
): Promise<Stagelet> {
  const sheet = new Sheet("itineraries");
  const questions = questionsOf(s);
  const answers = answersOf(s, questions);
  const facts = itineraryFacts(
    {
      title: titleFrom(s.description),
      description: s.description,
      ...s.window,
      questions,
    },
    answers,
    s.detail,
  );
  const made = await makeItineraries(models.itineraries.options, facts);
  // Every answer that was asked again, options and days, for tuning.
  const problems = [...(made.problems ?? [])];
  let inputTokens = made.inputTokens;
  let outputTokens = made.outputTokens;
  const options: ItineraryBody[] = [];
  // Over every option, how many items keep the venue the model named and
  // which were dropped.
  const venues: { kept: number; dropped: string[]; error?: string } = {
    kept: 0,
    dropped: [],
  };
  for (const option of made.itineraries) {
    if (!option.daysPending) {
      options.push(option);
      continue;
    }
    const written = await writeDays(
      models.itineraries.days,
      models.places,
      facts,
      option,
    );
    inputTokens += written.inputTokens;
    outputTokens += written.outputTokens;
    problems.push(
      ...(written.problems ?? []).map((p) => `${option.title} days: ${p}`),
    );
    venues.kept += written.venues.kept;
    venues.dropped.push(...written.venues.dropped);
    venues.error ??= written.venues.error;
    options.push({ ...option, days: written.days, daysPending: false });
  }

  // The rules code keeps whatever the model said.
  if (options.length < 1 || options.length > 3)
    sheet.hard("count", `${options.length} options`);
  const titles = options.map((o) => o.title);
  if (new Set(titles).size !== titles.length)
    sheet.hard("distinct-titles", titles.join(" | "));
  const labels = new Map(
    facts.choices.flatMap((group, i) =>
      group.choices.map((c) => [c.label, i] as const),
    ),
  );
  for (const option of options) {
    const name = `"${option.title}"`;
    if (!option.title || option.title.length > 60) sheet.hard("title", name);
    if (option.summary.length > 300) sheet.hard("summary", name);
    const slot = facts.slots.find(
      (x) => x.start === option.start && x.end === option.end,
    );
    if (!slot)
      sheet.hard(
        "slot",
        `${name} covers ${option.start} to ${option.end}, not a slot`,
      );
    else if (option.free !== slot.free || option.of !== facts.partySize)
      sheet.hard("free", `${name} says ${option.free} of ${option.of}`);
    const groups = option.picks.map((pick) => labels.get(pick));
    if (groups.some((g) => g === undefined))
      sheet.hard("picks", `${name} picks ${option.picks.join(", ")}`);
    if (new Set(groups).size !== groups.length)
      sheet.hard("one-pick-per-question", name);
    const span = daysBetween(option.start, option.end) + 1;
    if (option.days.length > 0) {
      if (
        option.days.length !== span ||
        option.days.some((d, i) => d.date !== addDays(option.start, i))
      )
        sheet.hard(
          "day-dates",
          `${name}: ${option.days.map((d) => d.date).join(", ")}`,
        );
      const again = checkDays(
        { days: option.days.map(({ title, items }) => ({ title, items })) },
        span,
        s.detail,
        { area: option.area, description: s.description },
      );
      if ("problem" in again) sheet.hard("days", `${name}: ${again.problem}`);
    }
    const texts = [
      option.title,
      option.summary,
      ...option.days.flatMap((d) => [
        d.title,
        ...d.items.flatMap((i) => [i.text, i.place ?? ""]),
      ]),
    ];
    const money = texts.filter(mentionsMoney);
    if (money.length > 0) sheet.hard("money", `${name}: ${money.join(" | ")}`);
  }
  // What the model was given: the facts without budgets, the cap or the names
  // of anyone the description does not already name.
  const inputs = [
    itineraryInput(facts),
    ...options.map((o) => daysInput(facts, o)),
  ].map((x) => JSON.stringify(x));
  if (inputs.some((t) => t.includes('"cap"')))
    sheet.hard("cap-in-prompt", "the cap was in a prompt");
  for (const reply of s.replies) {
    if (
      reply.budget !== undefined &&
      inputs.some((t) => hasWord(t, String(reply.budget)))
    )
      sheet.hard("budget-in-prompt", `${reply.name}'s budget was in a prompt`);
    if (
      !hasWord(s.description, reply.name) &&
      inputs.some((t) => hasWord(t, reply.name))
    )
      sheet.hard("name-in-prompt", `${reply.name} was named in a prompt`);
  }

  // The labels.
  const first = options[0];
  sheet.label(
    "model-answered",
    made.maker === "model",
    made.error ?? "code fallback",
  );
  if (made.maker === "model")
    sheet.label(
      "days-written",
      options.every((o) => o.days.length > 0),
      options
        .filter((o) => o.days.length === 0)
        .map((o) => o.title)
        .join(" | "),
    );
  if (s.expect.topSlot && first) {
    const [from, to] = s.expect.topSlot;
    const want = `${addDays(s.window.windowStart, from)} to ${addDays(s.window.windowStart, to)}`;
    sheet.label(
      "top-slot",
      `${first.start} to ${first.end}` === want,
      `first option covers ${first.start} to ${first.end}, not ${want}`,
    );
  }
  if (s.expect.everyoneIn && first && facts.slots[0])
    sheet.label(
      "everyone-in",
      first.free === facts.slots[0].free,
      `${first.free} of ${first.of} free on the first option`,
    );
  const lengths = options.map((o) => daysBetween(o.start, o.end) + 1);
  if (s.expect.minDays !== undefined)
    sheet.label(
      "min-days",
      lengths.every((n) => n >= s.expect.minDays!),
      `options of ${lengths.join(", ")} days`,
    );
  if (s.expect.maxDays !== undefined)
    sheet.label(
      "max-days",
      lengths.every((n) => n <= s.expect.maxDays!),
      `options of ${lengths.join(", ")} days`,
    );
  const places = options.flatMap((o) =>
    o.days.flatMap((d) => d.items.flatMap((i) => (i.place ? [i.place] : []))),
  );
  if (s.expect.noPlaces)
    sheet.label("no-places", places.length === 0, places.join(", "));
  const generic = places.filter((p) => genericPlace.test(p));
  sheet.label("no-generic-place", generic.length === 0, generic.join(", "));
  // Where the model named venues, how many the map found there; the ones it
  // did not are off the cards already. A lookup failure says the map, not
  // the model, is to blame.
  if (venues.kept + venues.dropped.length > 0)
    sheet.label(
      "venues-verified",
      venues.dropped.length === 0,
      `${venues.kept} kept, ${venues.dropped.length} dropped: ${venues.dropped.join(", ")}${venues.error ? ` (lookup failed: ${venues.error})` : ""}`,
    );

  return {
    findings: sheet.findings,
    labels: sheet.labels,
    itineraries: {
      maker: made.maker,
      attempt: made.attempt,
      problems,
      options,
    },
    inputTokens,
    outputTokens,
  };
}

export async function grade(
  s: Scenario,
  models: Models,
  only: Stage[] = stages,
): Promise<Graded> {
  const graded: Graded = {
    scenario: s.name,
    findings: [],
    labels: {},
    inputTokens: 0,
    outputTokens: 0,
  };
  const runs = {
    setup: gradeSetup,
    dates: gradeDates,
    itineraries: gradeItineraries,
  };
  for (const stage of only) {
    const {
      findings,
      labels,
      inputTokens = 0,
      outputTokens = 0,
      ...made
    } = await runs[stage](s, models);
    graded.findings.push(...findings);
    graded.labels[stage] = labels;
    graded.inputTokens += inputTokens;
    graded.outputTokens += outputTokens;
    Object.assign(graded, made);
  }
  return graded;
}
