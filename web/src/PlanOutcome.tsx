import type { SavedOutcome } from "./savedPlan";

export function PlanOutcome({ outcome }: { outcome: SavedOutcome }) {
  if (outcome.status === "pending") {
    return (
      <p className="text-sm text-slate-600">
        Planning in the background
        {outcome.stage ? ` (${outcome.stage})` : ""}...
      </p>
    );
  }
  if (outcome.status === "error") {
    return <p className="text-sm text-red-600">{outcome.message}</p>;
  }
  if (outcome.status === "no_matches") {
    return <p className="text-sm text-amber-700">{outcome.message}</p>;
  }
  return (
    <ul className="space-y-2">
      {outcome.options.map((o) => (
        <li key={o.candidateId} className="rounded border border-slate-200 p-3">
          <div className="font-medium">{o.name}</div>
          <div className="text-xs text-slate-500">
            {o.rating !== undefined && `Rated ${o.rating}`}
            {o.rating !== undefined && o.priceLevel !== undefined && " · "}
            {o.priceLevel !== undefined && `Price level ${o.priceLevel}`}
          </div>
          <p className="text-sm">{o.rationale}</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
            {o.constraintChecks.map((c) => (
              <li
                key={c}
                className={c.includes("unverified") ? "text-amber-700" : ""}
              >
                {c}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
