import {
  CITIES,
  DEFAULT_RADIUS_KM,
  MAX_RADIUS_KM,
  cityLocation,
  type FilterModes,
  type FilterName,
  type PlanJob,
  type User,
} from "@circles/shared";
import { useEffect, useState } from "react";
import { PlanOutcome } from "./PlanOutcome";
import type { SavedOutcome, SavedPlan } from "./savedPlan";
import { ModeSwitch, btn, field } from "./ui";

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
    label: "Food and drinks",
    description: "Find a restaurant that works for everyone.",
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

/** What each filter means, in the words the group would use. */
const FILTER_ROWS: { name: FilterName; label: string; detail: string }[] = [
  {
    name: "budget",
    label: "Within budget",
    detail: "Priced for the lowest budget in the group.",
  },
  {
    name: "openHours",
    label: "Open when you're free",
    detail: "Open for a full 2 hours when everyone is free.",
  },
  {
    name: "partySize",
    label: "Fits the group",
    detail: "Has room for everyone.",
  },
  {
    name: "area",
    label: "Close to the location",
    detail: "Inside the radius. Nearer places rank higher either way.",
  },
];

const DEFAULT_MODES: FilterModes = {
  budget: "hard",
  openHours: "hard",
  partySize: "hard",
  area: "prefer",
};

export function PlanNow({
  users,
  onSave,
  onClose,
}: {
  users: User[];
  onSave: (plan: SavedPlan) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<EventType | null>(null);

  // Escape closes the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-10 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-title"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 id="plan-title" className="font-display text-2xl font-bold">
            {chosen ? chosen.label : "What are you planning?"}
          </h2>
          <button className={btn.quiet} onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4">
          {chosen ? (
            <PlanForm
              users={users}
              onSave={onSave}
              onBack={() => setChosen(null)}
            />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {EVENT_TYPES.map((t) => (
                <li key={t.id}>
                  <button
                    disabled={!t.available}
                    onClick={() => setChosen(t)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left enabled:hover:bg-paper disabled:opacity-50"
                  >
                    <span>
                      <span className="block font-medium">{t.label}</span>
                      <span className="block text-sm text-ink-soft">
                        {t.description}
                      </span>
                    </span>
                    {!t.available && (
                      <span className="shrink-0 text-xs text-ink-faint">
                        Coming soon
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanForm({
  users,
  onSave,
  onBack,
}: {
  users: User[];
  onSave: (plan: SavedPlan) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Defaults to where whoever is making the plan is. Later this is their live location.
  const [plannerId, setPlannerId] = useState(users[0]!.id);
  const planner = users.find((u) => u.id === plannerId) ?? users[0]!;
  const homeCity = (u: User) =>
    CITIES.find((c) => c.name === u.location.name) ?? CITIES[0]!;
  const [cityId, setCityId] = useState(homeCity(planner).id);
  const [radius, setRadius] = useState(String(DEFAULT_RADIUS_KM));
  const [modes, setModes] = useState<FilterModes>(DEFAULT_MODES);
  const city = CITIES.find((c) => c.id === cityId)!;
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
          group: { members: users },
          location: cityLocation(city),
          radiusKm: Number(radius),
          filterModes: modes,
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
            ? "Couldn't reach the planner. Check that the api is running."
            : err instanceof Error
              ? err.message
              : "Something went wrong.",
      };
    }
    // Every attempt is kept, including ones that failed to start.
    onSave({
      id,
      createdAt: new Date().toISOString(),
      request,
      where: `${city.name}, ${radius} km`,
      timezone: city.timezone,
      members: users.length,
      outcome,
    });
    setStarted(outcome);
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <label className="block">
        <span className="text-sm font-medium">What are you after?</span>
        <input
          className={`${field} mt-1.5`}
          placeholder="Ramen, tacos, something with a patio"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <span className="mt-1 block text-xs text-ink-faint">
          Sent as is to the restaurant search. Leave it empty for any dinner
          spot.
        </span>
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Where</legend>
        <div className="mt-1.5 grid grid-cols-[1fr_6.5rem] gap-3">
          <label className="block">
            <span className="text-xs text-ink-soft">Search location</span>
            <select
              className={`${field} mt-1`}
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
            >
              {CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-ink-soft">Radius, km</span>
            <input
              className={`${field} mt-1`}
              type="number"
              min="1"
              max={MAX_RADIUS_KM}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
          </label>
        </div>
        <label className="mt-3 block">
          <span className="text-xs text-ink-soft">
            Planning as. Their location sets the default.
          </span>
          <select
            className={`${field} mt-1`}
            value={plannerId}
            onChange={(e) => {
              setPlannerId(e.target.value);
              const next = users.find((u) => u.id === e.target.value);
              if (next) setCityId(homeCity(next).id);
            }}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">
          How strict should we be?
        </legend>
        <p className="mt-1 text-xs text-ink-faint">
          A must-have drops any place that fails it. A preference keeps the
          place and ranks it lower.
        </p>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {FILTER_ROWS.map((row) => (
            <li
              key={row.name}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{row.label}</span>
                <span className="block text-xs text-ink-soft">
                  {row.detail}
                </span>
              </span>
              <ModeSwitch
                label={row.label}
                value={modes[row.name]}
                onChange={(v) => setModes((m) => ({ ...m, [row.name]: v }))}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={submitting} className={btn.primary}>
          {submitting ? "Starting" : "Find options"}
        </button>
        <button type="button" className={btn.secondary} onClick={onBack}>
          Back
        </button>
      </div>

      {started?.status === "pending" && (
        <p
          className="rounded-lg bg-brand-tint px-3 py-2 text-sm text-brand-deep"
          role="status"
        >
          Planning in the background. You can close this. The result will appear
          under Plans when it's ready.
        </p>
      )}
      {started?.status === "error" && <PlanOutcome outcome={started} />}
    </form>
  );
}
