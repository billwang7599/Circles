import { UserSchema, type User } from "@circles/ai";
import { useState } from "react";

interface Block {
  start: string; // datetime-local value, read in the browser's timezone
  end: string;
}

const input = "w-full rounded border border-slate-300 px-2 py-1";

// datetime-local gives local time with no zone; convert to a UTC instant.
const toUtc = (local: string) => (local ? new Date(local).toISOString() : "");

export function UserForm({
  onSave,
  onCancel,
}: {
  onSave: (u: User) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [distance, setDistance] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const setBlock = (i: number, patch: Partial<Block>) =>
    setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let unavailable;
    try {
      unavailable = blocks.map((b) => ({
        start: toUtc(b.start),
        end: toUtc(b.end),
      }));
    } catch {
      setErrors(["Enter a start and end for every time block"]);
      return;
    }
    const result = UserSchema.safeParse({
      id: crypto.randomUUID(),
      name,
      budget: budget === "" ? NaN : Number(budget),
      maxDistanceKm: distance === "" ? NaN : Number(distance),
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
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <label className="block text-sm">
        Name
        <input
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Budget per person
        <input
          className={input}
          type="number"
          min="0"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Max distance (km)
        <input
          className={input}
          type="number"
          min="0"
          step="any"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm">Unavailable times</legend>
        {blocks.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className={input}
              type="datetime-local"
              value={b.start}
              onChange={(e) => setBlock(i, { start: e.target.value })}
            />
            <span className="text-sm">to</span>
            <input
              className={input}
              type="datetime-local"
              value={b.end}
              onChange={(e) => setBlock(i, { end: e.target.value })}
            />
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() => setBlocks((bs) => bs.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-indigo-600"
          onClick={() => setBlocks((bs) => [...bs, { start: "", end: "" }])}
        >
          + Add time block
        </button>
      </fieldset>

      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-red-600">
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded bg-indigo-600 px-3 py-1.5 text-white"
        >
          Save
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1.5"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
