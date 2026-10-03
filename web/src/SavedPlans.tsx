import { PlanChat } from "./PlanChat";
import { PlanOutcome } from "./PlanOutcome";
import type { SavedPlan } from "./savedPlan";
import { Chip, btn } from "./ui";

function status(p: SavedPlan) {
  const o = p.outcome;
  if (o.status === "pending") return <Chip tone="brand">Planning</Chip>;
  if (o.status === "ok")
    return (
      <Chip tone="ok">
        {o.options.length} {o.options.length === 1 ? "option" : "options"}
      </Chip>
    );
  if (o.status === "no_matches") return <Chip tone="warn">No matches</Chip>;
  return <Chip tone="warn">Failed</Chip>;
}

export function SavedPlans({
  plans,
  onRemove,
  onUpdate,
  onClear,
}: {
  plans: SavedPlan[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<SavedPlan>) => void;
  onClear: () => void;
}) {
  return (
    <section aria-labelledby="plans-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="plans-heading" className="font-display text-xl font-bold">
          Plans
        </h2>
        {plans.length > 0 && (
          <button className={btn.danger} onClick={onClear}>
            Clear all
          </button>
        )}
      </div>

      {plans.length === 0 ? (
        <p className="mt-3 max-w-sm text-sm text-ink-soft">
          Every plan you generate is kept here, including the ones that found
          nothing. Add people, then choose Plan now.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {plans.map((p) => (
            <li key={p.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {p.request}
                    </span>
                    <span className="block text-xs text-ink-faint">
                      {p.where ?? p.cityName}, {p.members}{" "}
                      {p.members === 1 ? "person" : "people"},{" "}
                      {new Date(p.createdAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  {status(p)}
                </summary>
                <div className="space-y-3 pb-4">
                  <PlanOutcome outcome={p.outcome} timezone={p.timezone} />
                  <PlanChat
                    plan={p}
                    onUpdate={(patch) => onUpdate(p.id, patch)}
                  />
                  <button className={btn.danger} onClick={() => onRemove(p.id)}>
                    Delete this plan
                  </button>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
