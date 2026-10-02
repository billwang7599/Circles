import type { City, PlanJob, User } from "@circles/shared";
import { useState } from "react";
import { PlanOutcome } from "./PlanOutcome";
import type { SavedOutcome, SavedPlan } from "./savedPlan";

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
  onSave,
  onClose,
}: {
  users: User[];
  city: City;
  onSave: (plan: SavedPlan) => void;
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
          <PlanForm
            users={users}
            city={city}
            onSave={onSave}
            onBack={() => setChosen(null)}
          />
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
  onSave,
  onBack,
}: {
  users: User[];
  city: City;
  onSave: (plan: SavedPlan) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState<SavedOutcome | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const request = text.trim() || "dinner";
    setSubmitting(true);
    setStarted(null);
    let id: string = crypto.randomUUID();
    let outcome: SavedOutcome;
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: request,
          group: { city: city.id, timezone: city.timezone, members: users },
        }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error ?? `Request failed (${res.status})`);
      // The server returns at once. The result arrives later over the event stream.
      id = (body as PlanJob).id;
      outcome = { status: "pending" };
    } catch (err) {
      outcome = {
        status: "error",
        message:
          err instanceof TypeError
            ? "Couldn't reach the planner. Is the api running?"
            : err instanceof Error
              ? err.message
              : "Something went wrong",
      };
    }
    // Every attempt is kept, including ones that failed to start.
    onSave({
      id,
      createdAt: new Date().toISOString(),
      request,
      cityName: city.name,
      members: users.length,
      outcome,
    });
    setStarted(outcome);
    setSubmitting(false);
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
            disabled={submitting}
            className="rounded bg-emerald-600 px-3 py-1.5 text-white disabled:opacity-50"
          >
            {submitting ? "Starting..." : "Find options"}
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

      {started?.status === "pending" && (
        <p className="text-sm text-slate-600">
          Planning in the background. You can close this. The result will appear
          under Saved plans when it's ready.
        </p>
      )}
      {started?.status === "error" && <PlanOutcome outcome={started} />}
    </div>
  );
}
