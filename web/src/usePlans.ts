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

  // A plan's id is its own; the run being watched may be a newer one after a chat change.
  const pendingKey = plans
    .filter((p) => p.outcome.status === "pending")
    .map((p) => `${p.id}|${p.jobId ?? p.id}`)
    .join(",");

  useEffect(() => {
    const pending = new Map(
      pendingKey
        ? pendingKey.split(",").map((pair) => {
            const [planId, jobId] = pair.split("|") as [string, string];
            return [jobId, planId] as const;
          })
        : [],
    );

    // Stop watching runs that finished or whose plan was deleted.
    for (const [jobId, source] of sources.current) {
      if (!pending.has(jobId)) {
        source.close();
        sources.current.delete(jobId);
      }
    }

    for (const [jobId, planId] of pending) {
      if (sources.current.has(jobId)) continue;
      const source = new EventSource(`/api/plans/${jobId}/events`);
      sources.current.set(jobId, source);
      source.addEventListener("update", (e) => {
        const job: PlanJob = JSON.parse((e as MessageEvent).data);
        setOutcome(planId, jobToOutcome(job));
        // The server closes the stream after the last update. Close here too, or the
        // browser would reconnect forever.
        if (job.status === "done" || job.status === "failed") {
          source.close();
          sources.current.delete(jobId);
        }
      });
      source.onerror = () => {
        // A dropped connection reconnects by itself. CLOSED means the server refused,
        // for example it restarted and no longer knows this run.
        if (source.readyState === EventSource.CLOSED) {
          source.close();
          sources.current.delete(jobId);
          setOutcome(planId, {
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
    updatePlan: (id: string, patch: Partial<SavedPlan>) =>
      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      ),
    removePlan: (id: string) =>
      setPlans((prev) => prev.filter((p) => p.id !== id)),
    clearPlans: () => setPlans([]),
  };
}
