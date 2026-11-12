// Runs the planner over the hand-labelled scenarios in src/evals/scenarios.ts
// on the model api/.env names, or the fakes when BEDROCK_MODEL_ID is empty,
// and prints how it did: the hard rules (any miss is a planner bug, and the
// exit code is 1), the labels met per stage, every miss, and with --show
// what was made, to read for what code cannot check (real venues, sane
// pacing). It touches no database and writes nothing. The planner's own
// log lines come first; the report is at the end.
//
//   npm run eval -w api -- [--stage=setup|dates|itineraries] [--only=<part of a name>] [--show]
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { dayRange, weekdayOf } from "@circles/shared";
import { grade, stages, type Graded, type Stage } from "../src/evals/grade.ts";
import { scenarios } from "../src/evals/scenarios.ts";
import { modelsFor } from "../src/plan/models.ts";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const print = (line = "") => process.stdout.write(`${line}\n`);

const { values } = parseArgs({
  options: {
    stage: { type: "string" },
    only: { type: "string" },
    show: { type: "boolean", default: false },
  },
});
const isStage = (s: string): s is Stage => (stages as string[]).includes(s);
if (values.stage !== undefined && !isStage(values.stage)) {
  process.stderr.write(`--stage must be one of ${stages.join(", ")}\n`);
  process.exit(2);
}
const only: Stage[] =
  values.stage && isStage(values.stage) ? [values.stage] : stages;
const chosen = scenarios.filter(
  (s) => !values.only || s.name.includes(values.only),
);
if (chosen.length === 0) {
  process.stderr.write(`No scenario has "${values.only}" in its name\n`);
  process.exit(2);
}

const models = modelsFor({
  AWS_REGION: process.env.AWS_REGION ?? "ca-central-1",
  BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID ?? "",
  PLACES_MAX_REQUESTS: process.env.PLACES_MAX_REQUESTS,
  PLACES_BIAS: process.env.PLACES_BIAS,
});

// Four scenarios at a time, each through its stages in turn.
const started = performance.now();
const queue = [...chosen];
const results: Graded[] = [];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let s = queue.shift(); s; s = queue.shift())
      results.push(await grade(s, models, only));
  }),
);
results.sort(
  (a, b) =>
    chosen.findIndex((s) => s.name === a.scenario) -
    chosen.findIndex((s) => s.name === b.scenario),
);

const seconds = Math.round((performance.now() - started) / 1000);
const sum = (pick: (g: Graded) => number) =>
  results.reduce((n, g) => n + pick(g), 0);
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

if (values.show) {
  for (const g of results) {
    print();
    print(`## ${g.scenario}`);
    if (g.setup) {
      print(`setup: ${g.setup.title}`);
      for (const q of g.setup.questions) print(`  ${q}`);
    }
    if (g.dates !== undefined)
      print(
        `dates: ${g.dates ? `${g.dates.windowStart} to ${g.dates.windowEnd}` : "read nothing"}`,
      );
    if (g.itineraries) {
      const { maker, attempt, problems, options } = g.itineraries;
      print(
        `itineraries: ${maker}, attempt ${attempt}${problems.length ? `, rejected: ${problems.join(" / ")}` : ""}`,
      );
      options.forEach((o, i) => {
        print(
          `  ${i + 1}. ${o.title} (${dayRange(o.start, o.end)}, ${o.free} of ${o.of} free${o.overBudget ? ", over budget" : ""})${o.picks.length ? ` with ${o.picks.join(", ")}` : ""}`,
        );
        if (o.summary) print(`     ${o.summary}`);
        for (const day of o.days) {
          print(
            `     ${weekdays[weekdayOf(day.date)]} ${day.date}: ${day.title}`,
          );
          for (const item of day.items)
            print(
              `       ${item.when.padEnd(9)} ${item.text}${item.place ? ` @ ${item.place}` : ""}`,
            );
        }
      });
    }
  }
  print();
}

print(
  `Ran ${results.length} scenario${results.length === 1 ? "" : "s"} on ${models.setup.model} in ${seconds} s: ${sum((g) => g.inputTokens).toLocaleString()} tokens in, ${sum((g) => g.outputTokens).toLocaleString()} out`,
);
print(`${"stage".padEnd(13)}${"hard".padStart(6)}  labels met`);
for (const stage of only) {
  const findings = results.flatMap((g) =>
    g.findings.filter((f) => f.stage === stage),
  );
  const hard = findings.filter((f) => f.hard).length;
  const misses = findings.length - hard;
  const checked = results.reduce((n, g) => n + (g.labels[stage] ?? 0), 0);
  print(
    `${stage.padEnd(13)}${String(hard).padStart(6)}  ${checked - misses}/${checked}`,
  );
}
const misses = results.flatMap((g) =>
  g.findings.map((f) => ({ ...f, scenario: g.scenario })),
);
if (misses.length > 0) {
  print();
  print("Misses");
  for (const m of misses)
    print(
      `  ${m.hard ? "HARD " : "     "}${m.scenario.padEnd(24)}${m.stage.padEnd(13)}${m.rule.padEnd(20)}${m.detail}`,
    );
}

process.exit(misses.some((m) => m.hard) ? 1 : 0);
