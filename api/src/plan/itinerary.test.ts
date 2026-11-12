import type { Answers, ItineraryDay, Question } from "@circles/shared";
import { expect, test } from "vitest";
import { scriptedModel, skiTrip } from "../testModel.ts";
import {
  candidateSlots,
  checkDays,
  checkOptions,
  daysInput,
  eligibleChoices,
  fakeItineraries,
  groupCap,
  itineraryFacts,
  itineraryInput,
  makeItineraries,
  mentionsMoney,
  verifyPlaces,
  writeDays,
  type DaysOutput,
  type ItineraryBody,
  type ItineraryFacts,
  type ItineraryModel,
  type ItineraryOutput,
  type Slot,
} from "./itinerary.ts";
import { fakePlaces, type Places, type Venue } from "./places.ts";

// A Friday to the Sunday of the next week.
const window = { windowStart: "2026-12-04", windowEnd: "2026-12-13" };

const ranges = (...pairs: [string, string][]) =>
  pairs.map(([start, end]) => ({ start, end }));

const span = (slot: Slot) => `${slot.start} ${slot.end}`;

// Free for the whole window.
const whole = ranges([window.windowStart, window.windowEnd]);

test("slots rank by who is free, then weekend days, then the earliest", () => {
  const slots = candidateSlots(window, [
    ranges(["2026-12-04", "2026-12-06"], ["2026-12-11", "2026-12-13"]),
    ranges(["2026-12-05", "2026-12-06"]),
    whole,
  ]);
  expect(slots[0]).toEqual({
    id: "s1",
    start: "2026-12-05",
    end: "2026-12-06",
    days: 2,
    free: 3,
  });
  expect(slots.slice(1, 6).map(span)).toEqual([
    "2026-12-05 2026-12-05",
    "2026-12-06 2026-12-06",
    "2026-12-04 2026-12-06",
    "2026-12-11 2026-12-13",
    "2026-12-12 2026-12-13",
  ]);
  expect(slots).toHaveLength(12);
  expect(slots.map((s) => s.id)).toEqual(slots.map((_, i) => `s${i + 1}`));
  expect(slots.map((s) => s.free)).toEqual([3, 3, 3, ...Array(9).fill(2)]);
});

test("when no two people share a day the best slots stand anyway, twelve at most", () => {
  const slots = candidateSlots(window, [
    ranges(["2026-12-04", "2026-12-05"]),
    ranges(["2026-12-12", "2026-12-13"]),
  ]);
  expect(slots).toHaveLength(12);
  expect(slots.slice(0, 6).every((s) => s.free === 1)).toBe(true);
  expect(slots[6]!.free).toBe(0);
});

test("someone who has not said when is not counted free on any day", () => {
  const slots = candidateSlots(window, [
    ranges(["2026-12-05", "2026-12-06"]),
    undefined,
  ]);
  expect(slots).toHaveLength(12);
  expect(slots[0]).toEqual({
    id: "s1",
    start: "2026-12-05",
    end: "2026-12-06",
    days: 2,
    free: 1,
  });
  expect(slots.map((s) => s.free)).toEqual([1, 1, 1, ...Array(9).fill(0)]);
});

test("ranges are clipped to the window, and on a tie the earliest and shortest come first", () => {
  const slots = candidateSlots(window, [
    whole,
    whole,
    ranges(["2026-01-01", "2027-12-31"]),
  ]);
  expect(slots.every((s) => s.free === 3)).toBe(true);
  // Dec 4 to 6 is the earliest span with both weekend days.
  expect(slots.slice(0, 4).map(span)).toEqual([
    "2026-12-04 2026-12-06",
    "2026-12-04 2026-12-07",
    "2026-12-04 2026-12-08",
    "2026-12-04 2026-12-10",
  ]);
});

test("the group cap is the lowest budget anyone set", () => {
  expect(groupCap([600, null, 300])).toBe(300);
  expect(groupCap([null, null])).toBeNull();
  expect(groupCap([])).toBeNull();
});

const dates: Question = { kind: "dates", id: "d", title: "Dates", hint: "" };
const budget: Question = {
  kind: "budget",
  id: "b",
  title: "Your budget",
  hint: "",
  presets: [300, 600, 1000],
};
const resort: Question = {
  kind: "choice",
  id: "r",
  title: "Ski resort",
  hint: "",
  choices: [
    { id: "blue", label: "Blue Mountain", detail: "Collingwood, ON" },
    { id: "tremblant", label: "Mont Tremblant", detail: "Laurentians, QC" },
    { id: "banff", label: "Banff Sunshine", detail: "Alberta" },
  ],
};
const note: Question = {
  kind: "text",
  id: "n",
  title: "Anything else?",
  hint: "",
};
const questions = [dates, budget, resort, note];

const ben: Answers = {
  d: { kind: "dates", ranges: ranges(["2026-12-04", "2026-12-06"]) },
  b: { kind: "budget", max: 600 },
  r: { kind: "choice", choices: ["tremblant"] },
  n: { kind: "text", text: "Bringing my own skis" },
};
const chloe: Answers = {
  d: {
    kind: "dates",
    ranges: ranges(["2026-12-05", "2026-12-06"], ["2026-12-12", "2026-12-13"]),
  },
  b: { kind: "budget", max: 450 },
  r: { kind: "choice", choices: ["blue", "tremblant", "tremblant"] },
};

test("choices anyone picked are offered most picked first, or all when nobody picked", () => {
  expect(eligibleChoices(questions, [ben, chloe, { n: ben.n! }])).toEqual([
    {
      questionTitle: "Ski resort",
      choices: [
        { id: "tremblant", label: "Mont Tremblant", detail: "Laurentians, QC" },
        { id: "blue", label: "Blue Mountain", detail: "Collingwood, ON" },
      ],
    },
  ]);
  expect(eligibleChoices(questions, [{ n: ben.n! }])[0]!.choices).toHaveLength(
    3,
  );
  expect(
    eligibleChoices(questions, [
      { r: { kind: "choice", choices: ["gone"] } },
    ])[0]!.choices,
  ).toHaveLength(3);
  expect(eligibleChoices([dates, note], [ben])).toEqual([]);
});

const event = {
  title: "Ski trip",
  description: skiTrip,
  ...window,
  questions,
};
// The organizer is free for the whole window and says nothing else.
const alex: Answers = { d: { kind: "dates", ranges: whole } };
const facts = itineraryFacts(event, [alex, ben, chloe], "parts");

test("the facts carry the party size, the cap, ranked slots and tallied choices", () => {
  expect(facts).toMatchObject({
    partySize: 3,
    cap: 450,
    detail: "parts",
    choices: [{ questionTitle: "Ski resort" }],
  });
  expect(facts.slots[0]).toEqual({
    id: "s1",
    start: "2026-12-05",
    end: "2026-12-06",
    days: 2,
    free: 3,
  });
  // Someone in who has not answered yet is not known to be free.
  const unanswered = itineraryFacts(event, [null, ben, chloe], "parts");
  expect(unanswered.partySize).toBe(3);
  expect(unanswered.slots[0]).toMatchObject({
    start: "2026-12-05",
    end: "2026-12-06",
    free: 2,
  });
  // Without a dates question everyone is free everywhere.
  const open = itineraryFacts(
    { ...event, questions: [resort] },
    [null, ben, chloe],
    "hours",
  );
  expect(open.slots.every((s) => s.free === 3)).toBe(true);
  expect(open.cap).toBeNull();
});

test("the prompt carries no budget, cap, name or free text", () => {
  const input = itineraryInput(facts);
  expect(Object.keys(input).sort()).toEqual([
    "choices",
    "description",
    "detail",
    "partySize",
    "slots",
    "title",
    "windowEnd",
    "windowStart",
  ]);
  // A slot says how many can make it, never who.
  expect(Object.keys(input.slots[0]!).sort()).toEqual([
    "days",
    "end",
    "free",
    "id",
    "start",
    "weekdays",
  ]);
  // The model is handed the input as JSON.
  const prompt = JSON.stringify(input, null, 2);
  expect(prompt).not.toMatch(/budget|cap|price|\$|\b450\b|\b600\b/i);
  expect(prompt).not.toMatch(/skis|Chloe's|Ben's/);
});

const [s1, s2, , s4] = facts.slots as [Slot, Slot, Slot, Slot];

const option = (
  slot: Slot,
  title: string,
  costPerPerson: number,
  choiceIds = ["tremblant"],
): ItineraryOutput["options"][number] => ({
  slotId: slot.id,
  choiceIds,
  title,
  summary: "The closest hill, and the snow is best then.",
  costPerPerson,
  // The resort it goes with, as the prompt asks.
  area: choiceIds.includes("tremblant") ? "Mont Tremblant" : "Blue Mountain",
});

const good: ItineraryOutput = {
  options: [
    option(s1, "Weekend at Tremblant", 400),
    option(s4, "Long weekend", 700),
    option(s2, "Day trip", 200, ["blue"]),
  ],
};

const first = good.options[0]!;

test.each([
  {
    problem: "an unknown slot id",
    output: { options: [{ ...first, slotId: "s99" }] },
    message: /not one of the slots/,
  },
  {
    problem: "a choice nobody picked",
    output: { options: [{ ...first, choiceIds: ["banff"] }] },
    message: /not one of the choices/,
  },
  {
    problem: "two choices for one question",
    output: { options: [{ ...first, choiceIds: ["tremblant", "blue"] }] },
    message: /at most one per question/,
  },
  {
    problem: "two options with one title",
    output: { options: [first, { ...good.options[1]!, title: first.title }] },
    message: /different title/,
  },
  {
    problem: "a money word",
    output: { options: [{ ...first, summary: "Cheap lift tickets nearby." }] },
    message: /mentions money/,
  },
  {
    problem: "a title over 60 characters",
    output: { options: [{ ...first, title: "A".repeat(61) }] },
    message: /1 to 60 characters/,
  },
  {
    problem: "a day word the dates cannot bear",
    output: { options: [{ ...first, title: "Weeknight at Tremblant" }] },
    message: /weeknight, but Dec 5 – 6 falls on the weekend/,
  },
  {
    problem: "a claim that everyone can make a slot some cannot",
    output: {
      options: [
        {
          ...option(
            facts.slots.find((s) => s.free < 3)!,
            "Some of us",
            100,
          ),
          summary: "Everyone is free for it.",
        },
      ],
    },
    message: /says everyone can make it, but [12] of 3/,
  },
  {
    problem: "a weekday the slot does not touch",
    output: { options: [{ ...first, summary: "Up early on Friday." }] },
    message: /Friday, but Dec 5 – 6 is Sunday and Saturday/,
  },
  {
    problem: "a negative cost",
    output: { options: [{ ...first, costPerPerson: -5 }] },
    message: /0 or more/,
  },
  {
    problem: "an area nothing names",
    output: { options: [{ ...first, area: "Los Angeles" }] },
    message: /not a place the description or its choices name/,
  },
  {
    problem: "the wrong shape",
    output: { picks: [] },
    message: /1 to 5 options/,
  },
])(
  "$problem is rejected and the model is asked again",
  async ({ output, message }) => {
    const scripted = scriptedModel([output, good]);
    const made = await makeItineraries(scripted.model, facts);
    expect(made).toMatchObject({
      maker: "model",
      attempt: 2,
      inputTokens: 20,
      outputTokens: 10,
    });
    expect(scripted.rejections[1]![0]).toMatch(message);
  },
);

test("options within the group's cap are kept in the model's order, without the cost and with their days to come", async () => {
  const made = await makeItineraries(scriptedModel([good]).model, facts);
  expect(made.maker).toBe("model");
  expect(made.itineraries.map((i) => i.title)).toEqual([
    "Weekend at Tremblant",
    "Day trip",
  ]);
  expect(made.itineraries[0]).toMatchObject({
    start: "2026-12-05",
    end: "2026-12-06",
    picks: ["Mont Tremblant"],
    detail: "parts",
    days: [],
    daysPending: true,
    free: 3,
    of: 3,
    overBudget: false,
  });
  expect(made.itineraries[1]!.picks).toEqual(["Blue Mountain"]);
  expect(JSON.stringify(made.itineraries)).not.toMatch(
    /cost|\$|\b400\b|\b200\b/,
  );
});

// The first option of `good` as the route saves it before its days.
const weekend: ItineraryBody = {
  title: "Weekend at Tremblant",
  summary: "Everyone is free and it is the closest hill.",
  start: "2026-12-05",
  end: "2026-12-06",
  picks: ["Mont Tremblant"],
  area: "Mont Tremblant",
  detail: "parts",
  days: [],
  daysPending: true,
  free: 3,
  of: 3,
  overBudget: false,
};

const day = (title: string): DaysOutput["days"][number] => ({
  title,
  items: [
    { when: "Morning", text: "Drive up", place: "Mont Tremblant" },
    { when: "Afternoon", text: "First runs", place: null },
    { when: "Evening", text: "Dinner in the village", place: null },
  ],
});
const goodDays: DaysOutput = { days: [day("Getting there"), day("Last runs")] };
const one = goodDays.days[0]!;

// A map on which every venue exists wherever it is asked about.
const everywhere: Places = {
  source: "everywhere",
  search: async (name, area) => [{ name, address: area }],
};

test("the days prompt carries the option as its card reads and nothing about money, people or who is free", () => {
  const input = daysInput(facts, { ...weekend, overBudget: true });
  expect(input).toEqual({
    title: "Ski trip",
    description: skiTrip,
    partySize: 3,
    option: {
      title: "Weekend at Tremblant",
      summary: "Everyone is free and it is the closest hill.",
      start: "2026-12-05",
      end: "2026-12-06",
      days: 2,
      picks: [{ label: "Mont Tremblant", detail: "Laurentians, QC" }],
      area: "Mont Tremblant",
    },
    detail: "parts",
  });
  const prompt = JSON.stringify(input, null, 2);
  expect(prompt).not.toMatch(/budget|cap|price|cost|\$|\b450\b|\b600\b/i);
  // The description is the organizer's words, names and all; nothing else
  // about people goes in.
  expect(prompt).not.toMatch(/overBudget|daysPending|"free"|skis|Chloe's/);
});

test.each([
  {
    problem: "the wrong number of days",
    output: { days: [one] },
    message: /2 days long but the answer has 1/,
  },
  {
    problem: "a day with nothing in it",
    output: { days: [one, { ...one, items: [] }] },
    message: /1 to 4 items/,
  },
  {
    problem: "a part of the day that is not one",
    output: {
      days: [
        one,
        { ...one, items: [{ when: "Noon", text: "Lunch", place: null }] },
      ],
    },
    message: /Morning, Afternoon, Evening/,
  },
  {
    problem: "items out of order",
    output: { days: [one, { ...one, items: [...one.items].reverse() }] },
    message: /in order/,
  },
  {
    problem: "a day title over 60 characters",
    output: { days: [one, { ...one, title: "A".repeat(61) }] },
    message: /1 to 60 characters/,
  },
  {
    problem: "a money word in an item",
    output: {
      days: [
        one,
        {
          ...one,
          items: [{ when: "Morning", text: "Cheap lift tickets", place: null }],
        },
      ],
    },
    message: /mention money/,
  },
  {
    problem: "filler",
    output: {
      days: [
        one,
        {
          ...one,
          items: [
            { when: "Morning", text: "Rest and freshen up", place: null },
          ],
        },
      ],
    },
    message: /is filler/,
  },
  {
    problem: "the wrong shape",
    output: { options: [] },
    message: /object with days/,
  },
])(
  "in the days, $problem is rejected and the model is asked again",
  async ({ output, message }) => {
    const scripted = scriptedModel([output, goodDays]);
    const written = await writeDays(scripted.model, everywhere, facts, weekend);
    expect(written).toMatchObject({
      attempt: 2,
      inputTokens: 20,
      outputTokens: 10,
    });
    expect(scripted.rejections[1]![0]).toMatch(message);
    expect(written.days.map((d) => [d.date, d.title])).toEqual([
      ["2026-12-05", "Getting there"],
      ["2026-12-06", "Last runs"],
    ]);
    expect(written.days[0]!.items[0]).toEqual({
      when: "Morning",
      text: "Drive up",
      place: "Mont Tremblant",
    });
  },
);

test("with no area, a venue is rejected and the days are asked again without one", async () => {
  const bare: DaysOutput = {
    days: goodDays.days.map((d) => ({
      ...d,
      items: d.items.map((item) => ({ ...item, place: null })),
    })),
  };
  const scripted = scriptedModel([goodDays, bare]);
  const written = await writeDays(scripted.model, everywhere, facts, {
    ...weekend,
    area: null,
  });
  expect(written.attempt).toBe(2);
  expect(scripted.rejections[1]![0]).toMatch(/place must be null/);
  expect(
    written.days.flatMap((d) => d.items).every((i) => i.place === null),
  ).toBe(true);
});

// A ramen crawl's days as the model wrote them, venues and all.
const crawl: ItineraryDay[] = [
  {
    date: "2026-11-16",
    title: "West to east",
    items: [
      { when: "Morning", text: "Half bowls to start", place: "Kinton Ramen" },
      {
        when: "Afternoon",
        text: "Browse the stalls",
        place: "St. Lawrence Market",
      },
      { when: "Evening", text: "Tonkotsu to finish", place: "Ippudo" },
    ],
  },
  {
    date: "2026-11-17",
    title: "Back for more",
    items: [
      { when: "Morning", text: "The shio this time", place: "kinton ramen" },
      {
        when: "Afternoon",
        text: "Dumplings between bowls",
        place: "Chinatown Dumpling House",
      },
      { when: "Evening", text: "Last stop", place: "Sansotei Ramen" },
    ],
  },
  {
    date: "2026-11-18",
    title: "Uptown",
    items: [
      { when: "Morning", text: "Shio with a twist", place: "Santouka Ramen" },
      { when: "Afternoon", text: "Chicken paitan", place: "Marutama Ramen" },
      { when: "Evening", text: "One for the road", place: "Ramen Alley" },
    ],
  },
];

test("a venue stays only where the map finds one of that name in the area, looked up once each", async () => {
  const toronto = "Toronto, ON, Canada Toronto Ontario ON";
  const found: Record<string, Venue[]> = {
    // A branch name on the end.
    "Kinton Ramen": [
      { name: "KINTON RAMEN Baldwin", address: `51 Baldwin St, ${toronto}` },
    ],
    "St. Lawrence Market": [
      { name: "St Lawrence Market", address: `93 Front St E, ${toronto}` },
    ],
    // Exists, in another city.
    Ippudo: [
      {
        name: "Ippudo",
        address: "65 4th Ave, New York, NY 10003, USA New York",
      },
    ],
    // The neighbourhood, not a venue in it.
    "Chinatown Dumpling House": [
      { name: "Chinatown", address: `Chinatown, ${toronto}` },
    ],
    // Something else nearby.
    "Sansotei Ramen": [
      { name: "Ramen Isshin", address: `421 College St, ${toronto}` },
    ],
    // The same words in another order.
    "Santouka Ramen": [
      {
        name: "Hokkaido Ramen Santouka",
        address: `91 Dundas St E, ${toronto}`,
      },
    ],
    // A hyphen.
    "Marutama Ramen": [
      { name: "Marutama Ra-men", address: `4 Bloor St W, ${toronto}` },
    ],
    // Nothing of that name, only other ramen shops.
    "Ramen Alley": [
      { name: "Ramen Isshin", address: `421 College St, ${toronto}` },
      { name: "The Self Ramen Bar", address: `233 College St, ${toronto}` },
    ],
  };
  const asked: string[] = [];
  const places: Places = {
    source: "scripted",
    async search(name, area) {
      asked.push(name);
      expect(area).toBe("Toronto");
      return found[name] ?? [];
    },
  };
  const { days, venues } = await verifyPlaces(places, "Toronto", crawl);
  expect(asked.sort()).toEqual([
    "Chinatown Dumpling House",
    "Ippudo",
    "Kinton Ramen",
    "Marutama Ramen",
    "Ramen Alley",
    "Sansotei Ramen",
    "Santouka Ramen",
    "St. Lawrence Market",
  ]);
  expect(days.map((d) => d.items.map((i) => i.place))).toEqual([
    ["Kinton Ramen", "St. Lawrence Market", null],
    ["kinton ramen", null, null],
    ["Santouka Ramen", "Marutama Ramen", null],
  ]);
  expect(venues).toEqual({
    kept: 5,
    dropped: [
      "Ippudo",
      "Chinatown Dumpling House",
      "Sansotei Ramen",
      "Ramen Alley",
    ],
  });
  // The text stands whatever becomes of the venue.
  expect(days.map((d) => d.items.map((i) => i.text))).toEqual(
    crawl.map((d) => d.items.map((i) => i.text)),
  );
  expect(days.map((d) => [d.date, d.title])).toEqual(
    crawl.map((d) => [d.date, d.title]),
  );
});

test("a venue is in its area when the area's telling words start a word of its address or name", async () => {
  const known: Record<string, Venue[]> = {
    // The park's name is in the map's name for it, not the address.
    "Pog Lake Campground": [
      {
        name: "Pog Lake Campground (Algonquin Park)",
        address: "Nipissing District, ON, Canada",
      },
    ],
    // The county the map calls Prince Edward.
    "Waupoos Estates Winery": [
      {
        name: "Waupoos Estates Winery",
        address: "3016 CR-8, Picton, ON, Canada Prince Edward Ontario",
      },
    ],
    // The same name in another city.
    Ippudo: [{ name: "Ippudo", address: "65 4th Ave, New York, NY, USA" }],
    // The next town over, which the map puts within the area.
    "The Keg Steakhouse": [
      {
        name: "The Keg Steakhouse + Bar",
        address: "Blue Mountains, ON, Canada",
        nearArea: true,
      },
    ],
    // The same name in a far city that happens to share the area's name;
    // the map's verdict wins over the words.
    "Fox and Fiddle": [
      {
        name: "Fox and Fiddle",
        address: "London, England, United Kingdom",
        nearArea: false,
      },
    ],
    // A kind of place, not one.
    Market: [{ name: "St. Lawrence Market", address: "Toronto, ON" }],
    // The same name far outside it.
    "Mama Rosa's": [
      {
        name: "Mama Rosa's",
        address: "Sudbury, ON, Canada",
        nearArea: false,
      },
    ],
  };
  const places: Places = {
    source: "scripted",
    search: async (name) => known[name] ?? [],
  };
  const day = (place: string) => [
    {
      date: "2027-05-22",
      title: "Out",
      items: [{ when: "Morning", text: "Go", place }],
    },
  ];
  const kept = async (place: string, area: string) =>
    (await verifyPlaces(places, area, day(place))).days[0]!.items[0]!.place;
  expect(await kept("Pog Lake Campground", "Algonquin Park")).toBe(
    "Pog Lake Campground",
  );
  expect(await kept("Waupoos Estates Winery", "Prince Edward County")).toBe(
    "Waupoos Estates Winery",
  );
  expect(await kept("Ippudo", "Toronto")).toBeNull();
  expect(await kept("The Keg Steakhouse", "Collingwood, ON")).toBe(
    "The Keg Steakhouse",
  );
  expect(await kept("Mama Rosa's", "Collingwood, ON")).toBeNull();
  expect(await kept("Fox and Fiddle", "London")).toBeNull();
  expect(await kept("Market", "Toronto")).toBeNull();
});

test("accents, case and punctuation do not tell a venue or an area apart", async () => {
  const market: Places = {
    source: "scripted",
    search: async () => [
      {
        name: "Marché Jean-Talon",
        address: "7070 Av. Henri-Julien, Montreal, QC",
      },
    ],
  };
  const { days, venues } = await verifyPlaces(market, "Montréal", [
    {
      ...crawl[0]!,
      items: [
        { when: "Morning", text: "Breakfast", place: "the marche jean talon" },
      ],
    },
  ]);
  expect(days[0]!.items[0]!.place).toBe("the marche jean talon");
  expect(venues).toEqual({ kept: 1, dropped: [] });
});

test("a lookup that fails drops its venue and is reported once; with no area nothing is looked up", async () => {
  const down: Places = {
    source: "down",
    search: async () => {
      throw new Error(
        "Amazon Location answered AccessDeniedException: forbidden",
      );
    },
  };
  const { days, venues } = await verifyPlaces(down, "Toronto", crawl);
  expect(days.flatMap((d) => d.items).every((i) => i.place === null)).toBe(
    true,
  );
  expect(venues).toEqual({
    kept: 0,
    dropped: [
      "Kinton Ramen",
      "St. Lawrence Market",
      "Ippudo",
      "kinton ramen",
      "Chinatown Dumpling House",
      "Sansotei Ramen",
      "Santouka Ramen",
      "Marutama Ramen",
      "Ramen Alley",
    ],
    error: "Amazon Location answered AccessDeniedException: forbidden",
  });
  // With no area the only venues allowed are the organizer's own words.
  expect(await verifyPlaces(down, null, crawl)).toEqual({
    days: crawl,
    venues: { kept: 0, dropped: [] },
  });
});

test("a summary may contrast the slot's day with the one hoped for, or say that not everyone can come", () => {
  const partial = facts.slots.find((s) => s.free < 3)!;
  const accepted = (summary: string, slot = s1) =>
    checkOptions(
      { options: [{ ...option(slot, "Brunch", 100), summary }] },
      facts,
    );
  expect(
    accepted("Saturday rather than the Friday night you hoped for."),
  ).toHaveProperty("value");
  expect(
    accepted("Not everyone can make it, but two of three are free.", partial),
  ).toHaveProperty("value");
  expect(accepted("Pancakes everyone will love.", partial)).toHaveProperty(
    "value",
  );
  expect(accepted("Everyone can make it.", partial)).toMatchObject({
    problem: /says everyone can make it/,
  });
});

test("hour by hour, a day wraps past midnight once and then stays in the small hours", () => {
  const at = (whens: string[]) => ({
    days: [
      {
        title: "Late",
        items: whens.map((when) => ({ when, text: "Out", place: null })),
      },
    ],
  });
  const where = { area: null, description: "" };
  expect(
    checkDays(at(["21:00", "23:30", "00:15", "01:00"]), 1, "hours", where),
  ).toHaveProperty("value");
  expect(
    checkDays(at(["21:00", "00:15", "23:00"]), 1, "hours", where),
  ).toMatchObject({ problem: /in order/ });
  expect(
    checkDays(at(["21:00", "00:15", "00:10"]), 1, "hours", where),
  ).toMatchObject({ problem: /in order/ });
});

test("with no area, only a venue the organizer named may be a place", () => {
  const lifts = {
    days: [
      {
        ...one,
        items: [
          { when: "Morning", text: "Lifts open", place: "Blue Mountain" },
        ],
      },
    ],
  };
  expect(
    checkDays(lifts, 1, "parts", {
      area: null,
      description: "Family Day at Blue Mountain, we'll stay at the Westin",
    }),
  ).toHaveProperty("value");
  expect(
    checkDays(lifts, 1, "parts", { area: null, description: "Ski somewhere" }),
  ).toMatchObject({ problem: /"Blue Mountain" it does not/ });
});

test("hour by hour, items are clock times in order", () => {
  const at = (whens: string[]) => ({
    days: [
      {
        ...one,
        items: whens.map((when) => ({ when, text: "Ski", place: null })),
      },
    ],
  });
  expect(
    checkDays(at(["09:30", "12:00", "18:45"]), 1, "hours", {
      area: null,
      description: "",
    }),
  ).toHaveProperty("value");
  // An evening that runs past midnight stays in order, once.
  expect(
    checkDays(at(["21:00", "23:30", "00:15"]), 1, "hours", {
      area: null,
      description: "",
    }),
  ).toHaveProperty("value");
  expect(
    checkDays(at(["00:15", "09:00", "00:30"]), 1, "hours", {
      area: null,
      description: "",
    }),
  ).toMatchObject({ problem: /in order/ });
  expect(
    checkDays(at(["9:30"]), 1, "hours", { area: null, description: "" }),
  ).toMatchObject({
    problem: /24-hour time/,
  });
  expect(
    checkDays(at(["12:00", "09:30"]), 1, "hours", {
      area: null,
      description: "",
    }),
  ).toMatchObject({
    problem: /in order/,
  });
  expect(
    checkDays(at(["Morning"]), 1, "hours", { area: null, description: "" }),
  ).toMatchObject({
    problem: /24-hour time/,
  });
});

test("an option whose days never pass, or whose model cannot be reached, is left without any", async () => {
  const garbage = { days: [one] };
  const scripted = scriptedModel([garbage, garbage, garbage]);
  const written = await writeDays(scripted.model, everywhere, facts, weekend);
  expect(written).toMatchObject({ attempt: 3, error: /2 days long/ });
  expect(written.days).toEqual([]);
  const down = await writeDays(unreachable, everywhere, facts, weekend);
  expect(down).toMatchObject({
    attempt: 1,
    error: "connect ECONNREFUSED",
    unreachable: true,
    days: [],
    venues: { kept: 0, dropped: [] },
  });
});

test("without a cap the first three stand; when nothing fits, the cheapest stands flagged", async () => {
  const open = await makeItineraries(scriptedModel([good]).model, {
    ...facts,
    cap: null,
  });
  expect(open.itineraries).toHaveLength(3);
  expect(open.itineraries.every((i) => !i.overBudget)).toBe(true);

  const tight = await makeItineraries(scriptedModel([good]).model, {
    ...facts,
    cap: 100,
  });
  expect(tight.itineraries.map((i) => i.title)).toEqual(["Day trip"]);
  expect(tight.itineraries[0]!.overBudget).toBe(true);
});

test("after three bad answers, stretches that share no day stand in with the top choices and without days", async () => {
  const garbage = { options: [{ ...first, slotId: "s99" }] };
  const scripted = scriptedModel([garbage, garbage, garbage]);
  const made = await makeItineraries(scripted.model, facts);
  expect(scripted.rejections).toHaveLength(3);
  expect(made).toMatchObject({ maker: "code", attempt: 3 });
  // Not the one-day halves of the best weekend: other dates.
  expect(made.itineraries.map((i) => [i.title, i.free])).toEqual([
    ["Weekend, Dec 5 – 6", 3],
    ["Weekend, Dec 12 – 13", 2],
    ["Day trip, Dec 4", 2],
  ]);
  expect(made.itineraries[0]).toEqual({
    title: "Weekend, Dec 5 – 6",
    summary: "",
    start: "2026-12-05",
    end: "2026-12-06",
    picks: ["Mont Tremblant"],
    area: null,
    detail: "parts",
    days: [],
    daysPending: false,
    free: 3,
    of: 3,
    overBudget: false,
  });
});

// Answers nothing, for either call.
const unreachable = {
  model: "unreachable",
  fn: async () => {
    throw new Error("connect ECONNREFUSED");
  },
};

test("a model that cannot be reached gives way to the code fallback at once", async () => {
  const made = await makeItineraries(unreachable, facts);
  expect(made).toMatchObject({
    maker: "code",
    attempt: 1,
    error: "connect ECONNREFUSED",
  });
  expect(
    made.itineraries.every((i) => i.days.length === 0 && !i.daysPending),
  ).toBe(true);
});

test("when no stretch is shared, the code fallback offers the best one alone", async () => {
  const apart = itineraryFacts(
    event,
    [
      { d: { kind: "dates", ranges: ranges(["2026-12-04", "2026-12-05"]) } },
      { d: { kind: "dates", ranges: ranges(["2026-12-12", "2026-12-13"]) } },
    ],
    "parts",
  );
  const made = await makeItineraries(unreachable, apart);
  expect(made.itineraries).toHaveLength(1);
  expect(made.itineraries[0]).toMatchObject({
    title: "Weekend, Dec 12 – 13",
    free: 1,
    of: 2,
  });
  // Before anyone has said when, nobody is known to be free.
  const silent = itineraryFacts(event, [null, null], "parts");
  const quiet = await makeItineraries(unreachable, silent);
  expect(quiet.itineraries).toHaveLength(1);
  expect(quiet.itineraries[0]).toMatchObject({ free: 0, of: 2 });
});

test("the fake passes every check for both details and its costs rise by option", async () => {
  const fake: ItineraryModel = fakeItineraries();
  for (const detail of ["parts", "hours"] as const) {
    const open: ItineraryFacts = { ...facts, detail, cap: null };
    const response = await fake.options.fn(itineraryInput(open), []);
    const checked = checkOptions(response.output, open);
    expect(checked).toHaveProperty("value");
    if (!("value" in checked)) return;
    expect(checked.value.map((o) => o.costPerPerson)).toEqual([
      250, 500, 750, 1000, 1250,
    ]);
    const made = await makeItineraries(fake.options, open);
    expect(made).toMatchObject({ maker: "model", attempt: 1 });
    expect(made.itineraries).toHaveLength(3);
    for (const itinerary of made.itineraries) {
      const written = await writeDays(fake.days, fakePlaces(), open, itinerary);
      expect(written).toMatchObject({ attempt: 1 });
      expect(written.days.length).toBe(
        facts.slots.find(
          (s) => s.start === itinerary.start && s.end === itinerary.end,
        )!.days,
      );
      for (const item of written.days.flatMap((d) => d.items)) {
        expect(item.when).toMatch(
          detail === "parts" ? /^(Morning|Afternoon|Evening)$/ : /^\d\d:\d\d$/,
        );
        // The fake map knows resorts, parks and markets; the resort labels
        // here are none of those, so no venue survives.
        expect(item.place).toBeNull();
      }
      expect(written.venues.dropped.length).toBeLessThanOrEqual(1);
      expect(JSON.stringify(written.days)).not.toMatch(/cost|\$/);
    }
    expect(JSON.stringify(made.itineraries)).not.toMatch(/cost|\$/);
  }
});

test("money words are caught whole, so a place like Costa Rica passes", () => {
  for (const text of [
    "$40 lift tickets",
    "Dollars well spent",
    "Within budget",
    "Cheaper on weekdays",
    "An inexpensive lunch",
    "Priced for groups",
    "It costs a bit",
    "Affordable rooms",
  ])
    expect(mentionsMoney(text), text).toBe(true);
  for (const text of ["Costa Rica", "Priceville lookout", "Check in"])
    expect(mentionsMoney(text), text).toBe(false);
});
