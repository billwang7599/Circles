import { expect, test } from "vitest";
import { modelsFor } from "../plan/models.ts";
import { grade, scenarioProblems } from "./grade.ts";
import { scenarios } from "./scenarios.ts";

// The scenarios on the fakes: every rule code guarantees must hold on all of
// them, whatever the model does. The labels are the model's to meet and are
// read from a live run (npm run eval -w api), not asserted here.

const fakes = modelsFor({ AWS_REGION: "ca-central-1", BEDROCK_MODEL_ID: "" });

test("forty scenarios with distinct names, each sound against the shared schemas", () => {
  expect(scenarios.length).toBe(40);
  expect(new Set(scenarios.map((s) => s.name)).size).toBe(40);
  for (const scenario of scenarios)
    expect(scenarioProblems(scenario), scenario.name).toEqual([]);
});

test.each(scenarios.map((s) => [s.name, s] as const))(
  "%s keeps every hard rule on the fakes",
  async (_, scenario) => {
    const graded = await grade(scenario, fakes);
    expect(graded.findings.filter((f) => f.hard)).toEqual([]);
    expect(graded.itineraries?.options.length).toBeGreaterThan(0);
  },
);
