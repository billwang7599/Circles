import { useState } from "react";
import { UserForm } from "./UserForm";
import { makeSampleUsers } from "./sampleUsers";
import { useUsers } from "./useUsers";

export default function App() {
  const { users, addUser, addUsers, removeUser } = useUsers();
  const [adding, setAdding] = useState(false);

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Circles</h1>

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
