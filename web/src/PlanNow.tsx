import type { City, User } from "@circles/shared";
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
      <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {chosen ? chosen.label : "What do you want to plan?"}
          </h2>
          <button className="text-sm text-slate-600" onClick={onClose}>
            Close
          </button>
        </div>

        {chosen ? (
          <div className="space-y-3">
            <p className="text-sm">
              Planning for {users.length}{" "}
              {users.length === 1 ? "person" : "people"} in {city.name}.
            </p>
            {/* TODO: send the request to the planner once the api is wired. */}
            <p className="text-sm text-slate-600">
              The planner isn't connected yet.
            </p>
            <button
              className="rounded border border-slate-300 px-3 py-1.5"
              onClick={() => setChosen(null)}
            >
              Back
            </button>
          </div>
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
