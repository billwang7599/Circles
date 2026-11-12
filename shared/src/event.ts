import { z } from "zod";
import { dayRange, daysBetween, IsoDate, maxWindowDays } from "./time.ts";

// An event: what the organizer wrote, the window it could fall in, and the
// questions invitees answer from the link.

const Id = z.string().regex(/^[a-z0-9]{1,16}$/);
// For a question or choice made on the device or in code; unique within an
// event is all it has to be.
export const newId = () => Math.random().toString(36).slice(2, 10) || "0";

const EventDescription = z
  .string()
  .trim()
  .min(1, "Describe the plan")
  .max(300, "At most 300 characters");

export const EventTitle = z
  .string()
  .trim()
  .min(1, "Enter a title")
  .max(60, "At most 60 characters")
  .refine((t) => !/[\r\n]/.test(t), "Keep the title on one line");

const QuestionTitle = z
  .string()
  .trim()
  .min(1, "Enter a question")
  .max(60, "At most 60 characters");

// The line under a question on the invite page: what a budget covers, what
// to mention in an open answer.
const Hint = z.string().trim().max(120, "At most 120 characters");

export const Choice = z.object({
  id: Id,
  label: z
    .string()
    .trim()
    .min(1, "Enter an option")
    .max(40, "At most 40 characters"),
  // A short fact about it, such as where it is.
  detail: z.string().trim().max(60, "At most 60 characters"),
});
export type Choice = z.infer<typeof Choice>;

const distinct = (ids: string[]) => new Set(ids).size === ids.length;

const base = { id: Id, title: QuestionTitle, hint: Hint };

// The name is always asked and is not a question here. Budget presets are
// the dollar amounts between the ranges offered, per person for the whole
// event: [300, 600, 1000] offers under $300, $300 to $600, $600 to $1,000
// and $1,000+.
export const Question = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dates"), ...base }),
  z.object({
    kind: z.literal("budget"),
    ...base,
    presets: z
      .array(
        z
          .int("Enter whole amounts")
          .min(1, "At least $1")
          .max(100_000, "At most $100,000"),
      )
      .min(1, "Add an amount")
      .max(4, "At most 4 amounts")
      .refine((p) => p.every((amount, i) => i === 0 || amount > p[i - 1]!), {
        message: "Amounts must go up",
      }),
  }),
  z.object({
    kind: z.literal("choice"),
    ...base,
    choices: z
      .array(Choice)
      .min(2, "Add at least two options")
      .max(8, "At most 8 options")
      .refine((choices) => distinct(choices.map((c) => c.id)), {
        message: "Options repeat",
      }),
  }),
  z.object({ kind: z.literal("text"), ...base }),
]);
export type Question = z.infer<typeof Question>;
export type QuestionKind = Question["kind"];

export const maxQuestions = 8;

// One calendar and one budget at most: the itinerary reads them by kind.
export const Questions = z
  .array(Question)
  .max(maxQuestions, `At most ${maxQuestions} questions`)
  .refine((questions) => distinct(questions.map((q) => q.id)), {
    message: "Questions repeat",
  })
  .refine(
    (questions) =>
      (["dates", "budget"] as const).every(
        (kind) => questions.filter((q) => q.kind === kind).length <= 1,
      ),
    { message: "Only one dates question and one budget question" },
  );

export type BudgetRange = { label: string; max: number | null };

const dollars = (amount: number) =>
  `$${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

// The ranges a budget question offers. Each stands for its upper amount; the
// last has none.
export function budgetRanges(presets: number[]): BudgetRange[] {
  return [
    ...presets.map((max, i) => ({
      label:
        i === 0
          ? `Under ${dollars(max)}`
          : `${dollars(presets[i - 1]!)} – ${dollars(max)}`,
      max,
    })),
    { label: `${dollars(presets.at(-1)!)}+`, max: null },
  ];
}

export const DateRange = z
  .object({ start: IsoDate, end: IsoDate })
  .refine((r) => r.start <= r.end, {
    message: "The end can't be before the start",
  });
export type DateRange = z.infer<typeof DateRange>;

// One invitee's answer to a question, kept under the question's id. A budget
// is the most they would spend, null for no limit; it is private and never
// leaves the server except on that invitee's own page.
export const Answer = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dates"),
    // A 90-day window holds 45 days with none adjoining.
    ranges: z.array(DateRange).max(45, "Too many separate dates"),
  }),
  z.object({
    kind: z.literal("budget"),
    max: z.int().min(1).max(1_000_000).nullable(),
  }),
  z.object({ kind: z.literal("choice"), choices: z.array(Id).max(8) }),
  z.object({
    kind: z.literal("text"),
    text: z.string().trim().max(500, "At most 500 characters"),
  }),
]);
export type Answer = z.infer<typeof Answer>;
export const Answers = z.record(z.string(), Answer);
export type Answers = z.infer<typeof Answers>;

export type AnswerLine = { title: string; text: string };

// Someone's answers in words, one line per question they answered, in the
// questions' order. The budget is left out: it is nobody else's to read.
// Answers to a question since removed or changed in kind are skipped.
export function answerLines(
  questions: Question[],
  answers: Answers,
): AnswerLine[] {
  return questions.flatMap((question) => {
    const answer = answers[question.id];
    if (!answer || answer.kind !== question.kind) return [];
    let text = "";
    if (answer.kind === "dates")
      text = answer.ranges.map((r) => dayRange(r.start, r.end)).join(", ");
    if (answer.kind === "text") text = answer.text;
    if (answer.kind === "choice" && question.kind === "choice")
      text = question.choices
        .filter((choice) => answer.choices.includes(choice.id))
        .map((choice) => choice.label)
        .join(", ");
    return text ? [{ title: question.title, text }] : [];
  });
}

// Window dates are the organizer's own calendar days, both included. The
// timezone is only a rough hint of where the group is.
export const CreateEvent = z
  .object({
    description: EventDescription,
    windowStart: IsoDate,
    windowEnd: IsoDate,
    timezone: z.string().max(64).optional(),
  })
  .refine((e) => e.windowEnd >= e.windowStart, {
    message: "The end can't be before the start",
    path: ["windowEnd"],
  })
  .refine((e) => daysBetween(e.windowStart, e.windowEnd) <= maxWindowDays, {
    message: `At most ${maxWindowDays + 1} days`,
    path: ["windowEnd"],
  });
export type CreateEvent = z.infer<typeof CreateEvent>;

export const EditEvent = z.object({ title: EventTitle, questions: Questions });
export type EditEvent = z.infer<typeof EditEvent>;

// A date range in the organizer's words, with their calendar day so that
// "next month" means something and, when known, their time zone as a hint
// of whose holidays "Thanksgiving weekend" means.
export const ReadDates = z.object({
  text: z.string().trim().min(1, "Say when").max(120, "At most 120 characters"),
  today: IsoDate,
  timezone: z.string().max(64).optional(),
});
export type ReadDates = z.infer<typeof ReadDates>;

// How much of each day an itinerary fills in: a few things by part of day,
// or hour by hour.
export const Detail = z.enum(["parts", "hours"]);
export type Detail = z.infer<typeof Detail>;
export const MakeItineraries = z.object({ detail: Detail });
export type MakeItineraries = z.infer<typeof MakeItineraries>;

export const DayPart = z.enum(["Morning", "Afternoon", "Evening"]);
export type DayPart = z.infer<typeof DayPart>;

export type ItineraryItem = {
  // A part of the day, or a 24-hour time such as "09:30".
  when: string;
  text: string;
  // A place to look up on a map, when the item happens at one.
  place: string | null;
};

export type ItineraryDay = {
  date: string;
  title: string;
  items: ItineraryItem[];
};

export type Itinerary = {
  id: string;
  rank: number;
  title: string;
  summary: string;
  start: string;
  end: string;
  // The options from choice questions this plan goes with, as labels.
  picks: string[];
  detail: Detail;
  days: ItineraryDay[];
  // The days are still being written and fill in on a later read; false
  // once they are in, or when none are coming.
  daysPending: boolean;
  // How many of the people who are in are free on every day of it.
  free: number;
  of: number;
  // Nothing fit the group's budget and this came closest. Never an amount.
  overBudget: boolean;
};

export type EventSummary = {
  id: string;
  title: string;
  windowStart: string;
  windowEnd: string;
  isOrganizer: boolean;
  in: number;
  out: number;
};

export type ResponseView = {
  id: string;
  name: string;
  attending: boolean;
  // In, and has answered the questions.
  answered: boolean;
  you: boolean;
  // What they answered, budget left out. Only the organizer is sent these.
  answers: AnswerLine[];
};

export type EventView = {
  event: {
    id: string;
    // The invite link: /i/<slug> on the host the API gives out.
    url: string;
    title: string;
    windowStart: string;
    windowEnd: string;
    questions: Question[];
  };
  organizer: { name: string };
  isOrganizer: boolean;
  responses: ResponseView[];
  itineraries: Itinerary[];
  // Answers or questions changed since the itineraries were made.
  stale: boolean;
};

export const ClaimInvite = z.object({ token: z.string().min(1).max(200) });
export type ClaimInvite = z.infer<typeof ClaimInvite>;
export type ClaimResult = { eventId: string };

// Where someone signed in answers the questions: their own invite page.
export type AnswersLink = { url: string };
