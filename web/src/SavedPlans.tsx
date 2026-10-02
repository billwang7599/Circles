import { PlanOutcome } from "./PlanOutcome";
import type { SavedPlan } from "./savedPlan";

const summary = (p: SavedPlan) =>
  p.outcome.status === "pending"
    ? "Planning..."
    : p.outcome.status === "ok"
      ? `${p.outcome.options.length} option${p.outcome.options.length === 1 ? "" : "s"}`
      : p.outcome.status === "no_matches"
        ? "No matches"
        : "Failed";

export function SavedPlans({
  plans,
  onRemove,
  onClear,
}: {
  plans: SavedPlan[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (plans.length === 0) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Saved plans</h2>
        <button className="text-sm text-red-600" onClick={onClear}>
          Clear all
        </button>
      </div>
      <ul className="space-y-2">
        {plans.map((p) => (
          <li key={p.id} className="rounded border border-slate-200 bg-white">
            <details>
              <summary className="cursor-pointer p-3">
                <span className="font-medium">{p.request}</span>
                <span className="ml-2 text-sm text-slate-600">
                  {summary(p)} · {p.cityName} · {p.members}{" "}
                  {p.members === 1 ? "person" : "people"} ·{" "}
                  {new Date(p.createdAt).toLocaleString()}
                </span>
              </summary>
              <div className="space-y-2 p-3 pt-0">
                <PlanOutcome outcome={p.outcome} />
                <button
                  className="text-sm text-red-600"
                  onClick={() => onRemove(p.id)}
                >
                  Delete
                </button>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
