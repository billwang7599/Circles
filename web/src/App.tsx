import { useState } from "react";
import { PlanNow } from "./PlanNow";
import { SavedPlans } from "./SavedPlans";
import { UserForm } from "./UserForm";
import { makeSampleUsers } from "./sampleUsers";
import { Avatar, AvatarStack, Wordmark, btn } from "./ui";
import { usePlans } from "./usePlans";
import { useUsers } from "./useUsers";

export default function App() {
  const { users, addUser, addUsers, removeUser } = useUsers();
  const { plans, addPlan, removePlan, clearPlans } = usePlans();
  const [adding, setAdding] = useState(false);
  const [planning, setPlanning] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <header className="flex items-center justify-between gap-4 py-6">
        <Wordmark />
        <button
          className={btn.primary}
          disabled={users.length === 0}
          title={
            users.length === 0 ? "Add at least one person first" : undefined
          }
          onClick={() => setPlanning(true)}
        >
          Plan now
        </button>
      </header>

      <main className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="group-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="group-heading" className="font-display text-xl font-bold">
              Your group
            </h2>
            {users.length > 0 && (
              <AvatarStack names={users.map((u) => u.name)} />
            )}
          </div>

          {adding ? (
            <UserForm
              onSave={(u) => {
                addUser(u);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <button className={btn.secondary} onClick={() => setAdding(true)}>
                Add a person
              </button>
              <button
                className={btn.quiet}
                onClick={() => addUsers(makeSampleUsers())}
              >
                Add a sample group
              </button>
            </div>
          )}

          {users.length === 0 && !adding ? (
            <p className="max-w-sm text-sm text-ink-soft">
              No one here yet. Add the people you plan with, along with their
              budget and the times they're busy. Or load a sample group to try
              things out.
            </p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-3">
                  <Avatar name={u.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{u.name}</div>
                    <div className="text-xs text-ink-soft">
                      {u.location.name}, budget {u.budget},{" "}
                      {u.unavailable.length === 0
                        ? "free all the time"
                        : `busy ${u.unavailable.length} time${u.unavailable.length === 1 ? "" : "s"}`}
                    </div>
                  </div>
                  <button
                    className={btn.danger}
                    onClick={() => removeUser(u.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SavedPlans plans={plans} onRemove={removePlan} onClear={clearPlans} />
      </main>

      {planning && (
        <PlanNow
          users={users}
          onSave={addPlan}
          onClose={() => setPlanning(false)}
        />
      )}
    </div>
  );
}
