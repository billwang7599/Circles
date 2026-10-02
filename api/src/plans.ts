import {
  PlannerError,
  RequestLimitError,
  planEvent,
  type PlanDeps,
} from "@circles/ai";
import type { PlanJob, PlanRequest } from "@circles/shared";

export interface PlanStoreOptions {
  deps: PlanDeps;
  /** Plans running at once. Each costs search requests and model calls. Default 2. */
  maxConcurrent?: number;
  /** A plan still running after this long is marked failed. Default 3 minutes. */
  timeoutMs?: number;
  /** Finished plans kept in memory. Default 200. */
  maxJobs?: number;
}

type Listener = (job: PlanJob) => void;

const isFinished = (j: PlanJob) => j.status === "done" || j.status === "failed";

/**
 * Plans that run in the background, in memory. Subscribers are told whenever a plan
 * changes. State is lost on restart; swap this for a durable store later.
 */
export class PlanStore {
  private readonly jobs = new Map<string, PlanJob>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly queue: { id: string; request: PlanRequest }[] = [];
  private running = 0;
  private readonly maxConcurrent: number;
  private readonly timeoutMs: number;
  private readonly maxJobs: number;

  constructor(private readonly options: PlanStoreOptions) {
    this.maxConcurrent = options.maxConcurrent ?? 2;
    this.timeoutMs = options.timeoutMs ?? 3 * 60_000;
    this.maxJobs = options.maxJobs ?? 200;
  }

  /** Queue a plan and return it straight away. The work happens in the background. */
  submit(request: PlanRequest): PlanJob {
    const now = new Date().toISOString();
    const job: PlanJob = {
      id: crypto.randomUUID(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    this.evict();
    this.queue.push({ id: job.id, request });
    this.pump();
    return job;
  }

  get(id: string): PlanJob | undefined {
    return this.jobs.get(id);
  }

  /** Call `listener` on every change to the plan. Returns an unsubscribe function. */
  subscribe(id: string, listener: Listener): () => void {
    const set = this.listeners.get(id) ?? new Set();
    set.add(listener);
    this.listeners.set(id, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(id);
    };
  }

  private update(id: string, patch: Partial<PlanJob>) {
    const current = this.jobs.get(id);
    if (!current) return;
    const next: PlanJob = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(id, next);
    for (const listener of this.listeners.get(id) ?? []) listener(next);
  }

  private pump() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift()!;
      void this.run(next.id, next.request);
    }
  }

  private async run(id: string, request: PlanRequest) {
    this.running++;
    this.update(id, { status: "running" });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // The pipeline can't be cancelled yet, so a timed-out run keeps going unseen.
      const result = await Promise.race([
        planEvent(request, this.options.deps, {
          onProgress: (stage) => this.update(id, { stage }),
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("timeout")),
            this.timeoutMs,
          );
        }),
      ]);
      this.update(id, { status: "done", result });
    } catch (e) {
      console.error(`plan ${id} failed:`, e);
      this.update(id, { status: "failed", error: publicError(e) });
    } finally {
      clearTimeout(timer);
      this.running--;
      this.pump();
    }
  }

  /** Drop the oldest finished plans once over the cap. */
  private evict() {
    for (const [id, job] of this.jobs) {
      if (this.jobs.size <= this.maxJobs) return;
      if (isFinished(job)) this.jobs.delete(id);
    }
  }
}

/** Only messages we wrote ourselves reach the client; anything else may carry internals. */
function publicError(e: unknown): string {
  if (e instanceof PlannerError || e instanceof RequestLimitError)
    return e.message;
  if (e instanceof Error && e.message === "timeout")
    return "Planning took too long.";
  return "Planning failed.";
}
