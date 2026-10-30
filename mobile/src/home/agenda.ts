import {
  areaById,
  localDate,
  type CircleView,
  type NextPlan,
  type PlanSummary,
} from "@circles/shared";
import { formatTime, formatWindow } from "../dates";
import { circleTone, type CircleTone } from "../ui/theme";

export type AgendaItem = {
  plan: PlanSummary;
  circle: CircleView;
  tone: CircleTone;
  // The YYYY-MM-DD the plan sits on in the calendar: its locked day, or the
  // first day of its window while it is still being planned.
  day: string;
  // When it happens, as best known: "6:00 PM", or the window while open.
  when: string;
  sortKey: string;
};

export const isOver = (plan: PlanSummary) =>
  plan.phase.kind === "ended" || plan.phase.kind === "past";

export function agendaItem(plan: PlanSummary, circle: CircleView): AgendaItem {
  const timezone = areaById(plan.areaId).timezone;
  const locked = plan.lockedStart;
  return {
    plan,
    circle,
    tone: circleTone(circle.circle.id),
    day: locked ? localDate(new Date(locked), timezone) : plan.windowStart,
    when: locked
      ? formatTime(locked, timezone)
      : `Planning · ${formatWindow(plan.windowStart, plan.windowEnd)}`,
    sortKey: locked ?? plan.windowStart,
  };
}

// Every plan of every circle, soonest first.
export function agenda(circles: CircleView[]): AgendaItem[] {
  return circles
    .flatMap((circle) => circle.plans.map((plan) => agendaItem(plan, circle)))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function nextLine(next: NextPlan | null) {
  if (!next) return "No plans yet";
  switch (next.kind) {
    case "inputs":
      return "Add your budget and times";
    case "vote":
      return "Needs your vote";
    case "locked":
    case "open":
      return next.title;
  }
}

export const needsMe = (next: NextPlan | null) =>
  next?.kind === "inputs" || next?.kind === "vote";

// "Elora Roommates" → "ER", for the badges beside a plan.
export const circleInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0] ?? "")
    .join("")
    .toUpperCase();

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
