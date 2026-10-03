import {
  CITIES,
  UserSchema,
  cityLocation,
  zonedToUtc,
  type User,
} from "@circles/shared";
import { useState } from "react";
import { btn, field } from "./ui";

interface Block {
  start: string; // datetime-local value, read in the user's own time zone
  end: string;
}

// datetime-local gives a wall-clock time with no zone. Read it in the user's zone and store
// the UTC instant, so everyone's free time can be compared in one zone.
const toUtc = (local: string, timeZone: string) =>
  local ? zonedToUtc(local, timeZone) : "";

export function UserForm({
  onSave,
  onCancel,
}: {
  onSave: (u: User) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  // Picked by hand for now. Later this comes from the device's live location.
  const [cityId, setCityId] = useState(CITIES[0]!.id);
  const [budget, setBudget] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const city = CITIES.find((c) => c.id === cityId)!;
  const setBlock = (i: number, patch: Partial<Block>) =>
    setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let unavailable;
    try {
      unavailable = blocks.map((b) => ({
        start: toUtc(b.start, city.timezone),
        end: toUtc(b.end, city.timezone),
      }));
    } catch {
      setErrors(["Enter a start and end for every time block"]);
      return;
    }
    const result = UserSchema.safeParse({
      id: crypto.randomUUID(),
      name,
      location: cityLocation(city),
      budget: budget === "" ? NaN : Number(budget),
      unavailable,
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

      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input
          className={`${field} mt-1.5`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Where they are</span>
          <select
            className={`${field} mt-1.5`}
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
          <span className="text-sm font-medium">Budget per person</span>
          <input
            className={`${field} mt-1.5`}
            type="number"
            min="0"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">When they're not free</legend>
        <p className="text-xs text-ink-faint">
          Times are in {city.timezone}. We store them as UTC so everyone's
          schedules line up.
        </p>
        <ul className="mt-2 space-y-2">
          {blocks.map((b, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <input
                className={`${field} w-auto flex-1`}
                type="datetime-local"
                aria-label={`Block ${i + 1} start`}
                value={b.start}
                onChange={(e) => setBlock(i, { start: e.target.value })}
              />
              <span className="text-sm text-ink-soft">to</span>
              <input
                className={`${field} w-auto flex-1`}
                type="datetime-local"
                aria-label={`Block ${i + 1} end`}
                value={b.end}
                onChange={(e) => setBlock(i, { end: e.target.value })}
              />
              <button
                type="button"
                className={btn.danger}
                onClick={() => setBlocks((bs) => bs.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`${btn.quiet} mt-1 -ml-2`}
          onClick={() => setBlocks((bs) => [...bs, { start: "", end: "" }])}
        >
          Add a time block
        </button>
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
