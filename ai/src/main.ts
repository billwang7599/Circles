// Dev runner: run the pipeline from the terminal on fakes (npm run dev).
import { addDays, areaById, windowFor } from "@circles/shared";
import type { PlanRequest } from "./types.ts";
import { FakeRestaurantClient, createFakeLlmModel } from "./devFakes.ts";
import { LlmClient } from "./llm.ts";
import { planEvent } from "./plan.ts";

const area = areaById("uptown");
const { windowStart, windowEnd } = windowFor("week", area.timezone, new Date());

const request: PlanRequest = {
  text: process.argv.slice(2).join(" ") || "dinner",
  areaId: area.id,
  windowStart,
  windowEnd,
  radiusKm: area.radiusKm,
  filterModes: {
    budget: "hard",
    openHours: "hard",
    partySize: "hard",
    area: "prefer",
  },
  group: {
    members: [
      {
        id: "1",
        name: "Alex",
        budgetCents: 3000,
        busy: [{ date: addDays(windowStart, 1), part: "evening" }],
        preferences: ["ramen"],
      },
      { id: "2", name: "Sam", budgetCents: 4000, busy: [], preferences: [] },
      {
        id: "3",
        name: "Jordan",
        budgetCents: 6000,
        busy: [],
        preferences: [],
      },
    ],
  },
};

const result = await planEvent(request, {
  llm: new LlmClient(createFakeLlmModel()),
  restaurants: new FakeRestaurantClient(),
});
console.log(JSON.stringify(result, null, 2));
