import { MemberSchema, type Member } from "@circles/ai";
import {
  AREAS,
  Part,
  datesIn,
  windowFor,
  type BusyPart,
} from "@circles/shared";
import { useState } from "react";
import { btn, field } from "./ui";

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));

export function UserForm({
  onSave,
  onCancel,
}: {
  onSave: (u: Member) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState<BusyPart[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Every area is in one zone, and the longest plan window is two weeks.
  const { windowStart, windowEnd } = windowFor(
    "twoWeeks",
    AREAS[0]!.timezone,
    new Date(),
  );
  const dates = datesIn(windowStart, windowEnd);
  const isBusy = (date: string, part: Part) =>
    busy.some((b) => b.date === date && b.part === part);
  const toggleBusy = (date: string, part: Part) =>
    setBusy((bs) =>
      isBusy(date, part)
        ? bs.filter((b) => b.date !== date || b.part !== part)
        : [...bs, { date, part }],
    );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = MemberSchema.safeParse({
      id: crypto.randomUUID(),
      name,
      budgetCents:
        budget.trim() === "" ? undefined : Math.round(Number(budget) * 100),
      busy,
      preferences: [],
    });
    if (!result.success) {
      setErrors(
        result.error.issues.map(
          (i) => `${i.path.join(".") || "user"}: ${i.message}`,
        ),
      );
      return;
    }
    onSave(result.data);
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-2xl border border-line bg-surface p-5"
    >
      <h3 className="font-display text-lg font-bold">Add a person</h3>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            className={`${field} mt-1.5`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Budget per person, $</span>
          <input
            className={`${field} mt-1.5`}
            type="number"
            min="0"
            step="0.01"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">When they're busy</legend>
        <ul className="mt-2 space-y-1">
          {dates.map((date) => (
            <li key={date} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-xs text-ink-soft">
                {formatDate(date)}
              </span>
              {Part.options.map((part) => (
                <button
                  key={part}
                  type="button"
                  aria-pressed={isBusy(date, part)}
                  aria-label={`${formatDate(date)} ${part}`}
                  onClick={() => toggleBusy(date, part)}
                  className={`flex-1 rounded-full border px-2 py-0.5 text-xs capitalize ${
                    isBusy(date, part)
                      ? "border-brand bg-brand text-white"
                      : "border-line text-ink-soft hover:border-brand"
                  }`}
                >
                  {part}
                </button>
              ))}
            </li>
          ))}
        </ul>
      </fieldset>

      {errors.length > 0 && (
        <ul
          className="space-y-0.5 rounded-lg bg-bad-tint px-3 py-2 text-sm text-bad"
          role="alert"
        >
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button type="submit" className={btn.primary}>
          Save person
        </button>
        <button type="button" className={btn.secondary} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
