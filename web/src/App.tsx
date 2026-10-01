import { CITIES } from "@circles/shared";
import { useState } from "react";
import { PlanNow } from "./PlanNow";
import { UserForm } from "./UserForm";
import { makeSampleUsers } from "./sampleUsers";
import { useCity } from "./useCity";
import { useUsers } from "./useUsers";

export default function App() {
  const { users, addUser, addUsers, removeUser } = useUsers();
  const { city, setCityId } = useCity();
  const [adding, setAdding] = useState(false);
  const [planning, setPlanning] = useState(false);

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Circles</h1>

      <label className="block text-sm">
        City
        <select
          className="w-full rounded border border-slate-300 px-2 py-1"
          value={city.id}
          onChange={(e) => setCityId(e.target.value)}
        >
          {CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-slate-600">Timezone: {city.timezone}</span>
      </label>

      {adding ? (
        <UserForm
          onSave={(u) => {
            addUser(u);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="flex gap-2">
          <button
            className="rounded bg-indigo-600 px-3 py-1.5 text-white"
            onClick={() => setAdding(true)}
          >
            Add user
          </button>
          <button
            className="rounded border border-slate-300 px-3 py-1.5"
            onClick={() => addUsers(makeSampleUsers())}
          >
            Add sample users
          </button>
        </div>
      )}

      <button
        className="rounded bg-emerald-600 px-3 py-1.5 text-white disabled:opacity-50"
        disabled={users.length === 0}
        title={users.length === 0 ? "Add at least one user first" : undefined}
        onClick={() => setPlanning(true)}
      >
        Plan Now
      </button>

      {planning && (
        <PlanNow users={users} city={city} onClose={() => setPlanning(false)} />
      )}

      <ul className="space-y-2">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex items-center justify-between rounded border border-slate-200 bg-white p-3"
          >
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-sm text-slate-600">
                Budget {u.budget} · within {u.maxDistanceKm} km ·{" "}
                {u.unavailable.length} unavailable block
                {u.unavailable.length === 1 ? "" : "s"}
              </div>
            </div>
            <button
              className="text-sm text-red-600"
              onClick={() => removeUser(u.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
