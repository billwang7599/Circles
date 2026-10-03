import type { PlanJob, PlanRequest } from "@circles/shared";
import { useState } from "react";
import type { ChatMessage, SavedPlan } from "./savedPlan";
import { btn, field } from "./ui";

const EXAMPLES = [
  "Find hotpot instead",
  "Try Sunday evening",
  "Raise the budget",
  "Search within 25 km",
];

interface ChatReply {
  changed: boolean;
  changes: string[];
  request: PlanRequest;
  job?: PlanJob;
}

/**
 * Chat to change a plan. A message is read as a change to the plan's request; if it
 * changes anything, the plan runs again and its results are replaced.
 */
export function PlanChat({
  plan,
  onUpdate,
}: {
  plan: SavedPlan;
  onUpdate: (patch: Partial<SavedPlan>) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const chat = plan.chat ?? [];

  if (!plan.params) {
    return (
      <p className="text-xs text-ink-faint">
        This plan was saved before chat existed, so it can't be changed here.
        Plan again to get one that can.
      </p>
    );
  }
  const params = plan.params;
  const running = plan.outcome.status === "pending";

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || sending || running) return;
    setSending(true);
    setText("");
    const withUser: ChatMessage[] = [...chat, { role: "user", text: message }];
    onUpdate({ chat: withUser });
    try {
      const res = await fetch("/api/plans/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, request: params }),
      });
      const body = await res.json();
      if (!res.ok)
        throw new Error(body.error ?? `Request failed (${res.status})`);
      const reply = body as ChatReply;
      if (!reply.changed || !reply.job) {
        onUpdate({
          chat: [
            ...withUser,
            {
              role: "assistant",
              text: "I couldn't find anything to change in that. Say what you'd like different, such as the food, the day, the budget or the radius.",
            },
          ],
        });
      } else {
        onUpdate({
          chat: [
            ...withUser,
            {
              role: "assistant",
              text: "Updated. Planning again.",
              changes: reply.changes,
            },
          ],
          params: reply.request,
          request: reply.request.text,
          where: `${reply.request.location.name}, ${reply.request.radiusKm} km`,
          timezone: reply.request.location.timezone,
          jobId: reply.job.id,
          outcome: { status: "pending" },
        });
      }
    } catch (err) {
      onUpdate({
        chat: [
          ...withUser,
          {
            role: "assistant",
            text:
              err instanceof TypeError
                ? "Couldn't reach the planner. Check that the api is running."
                : err instanceof Error
                  ? err.message
                  : "Something went wrong.",
          },
        ],
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-label="Change this plan" className="rounded-xl bg-paper p-4">
      <h4 className="font-display text-base font-bold">Change this plan</h4>
      <p className="mt-0.5 text-xs text-ink-soft">
        Say what you want different. For example, "find hotpot instead of
        buffet, on Sunday, with a bigger budget".
      </p>

      {chat.length > 0 && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {chat.map((m, i) => (
            <li
              key={i}
              className={
                m.role === "user"
                  ? "ml-8 rounded-xl rounded-br-sm bg-brand px-3 py-2 text-sm text-white"
                  : "mr-8 rounded-xl rounded-bl-sm border border-line bg-surface px-3 py-2 text-sm"
              }
            >
              {m.text}
              {m.changes && m.changes.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs text-ink-soft">
                  {m.changes.map((c) => (
                    <li
                      key={c}
                      className="before:mr-1.5 before:text-ok before:content-['✓']"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            type="button"
            disabled={sending || running}
            className="rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-ink-soft enabled:hover:border-brand enabled:hover:text-brand-deep disabled:opacity-50"
            onClick={() => setText(e)}
          >
            {e}
          </button>
        ))}
      </div>

      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <input
          className={field}
          aria-label="Message"
          placeholder={running ? "Planning, one moment" : "What should change?"}
          value={text}
          disabled={running}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className={btn.primary}
          disabled={sending || running || text.trim() === ""}
        >
          {sending ? "Sending" : "Send"}
        </button>
      </form>
    </section>
  );
}
