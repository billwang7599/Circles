import type { PlanJob } from "@circles/shared";
import { useEffect, useRef, useState } from "react";
import { jobToOutcome, type SavedOutcome, type SavedPlan } from "./savedPlan";

const KEY = "circles.plans";

function load(): SavedPlan[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // storage blocked or corrupt: start empty
  }
}

/**
 * Planning attempts held in state and mirrored to localStorage, newest first. Plans that
 * are still pending are watched over Server-Sent Events, so results arrive even after
 * the Plan Now popup is closed, and pick up again after a page refresh.
 */
export function usePlans() {
  const [plans, setPlans] = useState<SavedPlan[]>(load);
  const sources = useRef(new Map<string, EventSource>());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(plans));
    } catch {
      // storage unavailable: state still works for this session
    }
  }, [plans]);

  const setOutcome = (id: string, outcome: SavedOutcome) =>
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, outcome } : p)));

  const pendingKey = plans
    .filter((p) => p.outcome.status === "pending")
    .map((p) => p.id)
    .join(",");

  useEffect(() => {
    const pending = new Set(pendingKey ? pendingKey.split(",") : []);

    // Stop watching plans that finished or were deleted.
    for (const [id, source] of sources.current) {
      if (!pending.has(id)) {
        source.close();
        sources.current.delete(id);
      }
    }

    for (const id of pending) {
      if (sources.current.has(id)) continue;
      const source = new EventSource(`/api/plans/${id}/events`);
      sources.current.set(id, source);
      source.addEventListener("update", (e) => {
        const job: PlanJob = JSON.parse((e as MessageEvent).data);
        setOutcome(id, jobToOutcome(job));
        // The server closes the stream after the last update. Close here too, or the
        // browser would reconnect forever.
        if (job.status === "done" || job.status === "failed") {
          source.close();
          sources.current.delete(id);
        }
      });
      source.onerror = () => {
        // A dropped connection reconnects by itself. CLOSED means the server refused,
        // for example it restarted and no longer knows this plan.
        if (source.readyState === EventSource.CLOSED) {
          source.close();
          sources.current.delete(id);
          setOutcome(id, {
            status: "error",
            message: "Lost track of this plan. The server may have restarted.",
          });
        }
      };
    }
  }, [pendingKey]);

  useEffect(
    () => () => {
      for (const source of sources.current.values()) source.close();
      sources.current.clear();
    },
    [],
  );

  return {
    plans,
    addPlan: (p: SavedPlan) => setPlans((prev) => [p, ...prev]),
    removePlan: (id: string) =>
      setPlans((prev) => prev.filter((p) => p.id !== id)),
    clearPlans: () => setPlans([]),
  };
}
