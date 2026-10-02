import type { City, PlanResponse, User } from "@circles/shared";
import { useState } from "react";

interface EventType {
  id: string;
  label: string;
  description: string;
  available: boolean;
}

// Only restaurants are planned today. Other domains are deferred.
const EVENT_TYPES: EventType[] = [
  {
    id: "restaurant",
    label: "Food & drinks",
    description: "Find a restaurant that fits everyone.",
    available: true,
  },
  {
    id: "activity",
    label: "Activity",
    description: "Things to do together.",
    available: false,
  },
  {
    id: "trip",
    label: "Trip",
    description: "Multi-day plans and flights.",
    available: false,
  },
];

export function PlanNow({
  users,
  city,
  onClose,
}: {
  users: User[];
  city: City;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<EventType | null>(null);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-lg bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {chosen ? chosen.label : "What do you want to plan?"}
          </h2>
          <button className="text-sm text-slate-600" onClick={onClose}>
            Close
          </button>
        </div>

        {chosen ? (
          <PlanForm users={users} city={city} onBack={() => setChosen(null)} />
        ) : (
          <ul className="space-y-2">
            {EVENT_TYPES.map((t) => (
              <li key={t.id}>
                <button
                  disabled={!t.available}
                  onClick={() => setChosen(t)}
                  className="w-full rounded border border-slate-300 p-3 text-left enabled:hover:bg-slate-50 disabled:opacity-50"
                >
                  <div className="font-medium">
                    {t.label}
                    {!t.available && (
                      <span className="ml-2 text-xs text-slate-500">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600">{t.description}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PlanForm({
  users,
  city,
  onBack,
}: {
  users: User[];
  city: City;
  onBack: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: text.trim() || "dinner",
          group: { city: city.id, timezone: city.timezone, members: users },
        }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error ?? `Request failed (${res.status})`);
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Planning for {users.length} {users.length === 1 ? "person" : "people"}{" "}
        in {city.name}.
      </p>
      <form onSubmit={submit} className="space-y-2">
        <input
          className="w-full rounded border border-slate-300 px-2 py-1"
          placeholder="e.g. ramen for 4"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-emerald-600 px-3 py-1.5 text-white disabled:opacity-50"
          >
            {loading ? "Planning..." : "Find options"}
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5"
            onClick={onBack}
          >
            Back
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result?.status === "no_matches" && (
        <p className="text-sm text-amber-700">{result.message}</p>
      )}

      {result?.status === "ok" && (
        <ul className="space-y-2">
          {result.options.map((o) => {
            const place = result.candidates.find((c) => c.id === o.candidateId);
            return (
              <li
                key={o.candidateId}
                className="rounded border border-slate-200 p-3"
              >
                <div className="font-medium">
                  {place?.name ?? o.candidateId}
                </div>
                <p className="text-sm">{o.rationale}</p>
                <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                  {o.constraintChecks.map((c) => (
                    <li
                      key={c}
                      className={
                        c.includes("unverified") ? "text-amber-700" : ""
                      }
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
