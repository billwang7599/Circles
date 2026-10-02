// Dev runner: run the pipeline from the terminal on fakes (npm run dev).
import type { PlanRequest } from "@circles/shared";
import { FakeRestaurantClient, createFakeLlmModel } from "./fakes.ts";
import { LlmClient } from "./llm.ts";
import { planEvent } from "./plan.ts";

const day = (offset: number, hour: number, hours: number) => {
  const s = new Date();
  s.setUTCDate(s.getUTCDate() + offset);
  s.setUTCHours(hour, 0, 0, 0);
  return {
    start: s.toISOString(),
    end: new Date(s.getTime() + hours * 3600_000).toISOString(),
  };
};

const request: PlanRequest = {
  text: process.argv.slice(2).join(" ") || "dinner for 3",
  group: {
    city: "toronto",
    timezone: "America/Toronto",
    members: [
      {
        id: "1",
        name: "Alex",
        budget: 30,
        maxDistanceKm: 5,
        unavailable: [day(1, 14, 8)],
      },
      { id: "2", name: "Sam", budget: 40, maxDistanceKm: 10, unavailable: [] },
      {
        id: "3",
        name: "Jordan",
        budget: 60,
        maxDistanceKm: 8,
        unavailable: [],
      },
    ],
  },
};

const result = await planEvent(request, {
  llm: new LlmClient(createFakeLlmModel()),
  restaurants: new FakeRestaurantClient(),
});
console.log(JSON.stringify(result, null, 2));
