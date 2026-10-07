// Dev runner: run the pipeline from the terminal on fakes (npm run dev).
import { cityLocation, findCity, type PlanRequest } from "@circles/shared";
import { FakeRestaurantClient, createFakeLlmModel } from "./devFakes.ts";
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

const toronto = cityLocation(findCity("toronto")!);

const request: PlanRequest = {
  text: process.argv.slice(2).join(" ") || "dinner",
  location: toronto,
  radiusKm: 15,
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
        location: toronto,
        budget: 30,
        unavailable: [day(1, 14, 8)],
      },
      {
        id: "2",
        name: "Sam",
        location: toronto,
        budget: 40,
        unavailable: [],
      },
      {
        id: "3",
        name: "Jordan",
        location: toronto,
        budget: 60,
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
