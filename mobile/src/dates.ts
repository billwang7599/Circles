import { partHours, type Interval, type Part } from "@circles/shared";
import { useEffect, useState } from "react";

export const partLabels: Record<Part, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

// An hour of the day, short: "8am", "12pm", "11pm".
function formatHour(hour: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(2000, 0, 1, hour)))
    .replace(/\s/g, "")
    .toLowerCase();
}

// The hours a part of the day covers: "5pm–11pm".
export function formatPartHours(part: Part) {
  const [from, to] = partHours[part];
  return `${formatHour(from)}–${formatHour(to)}`;
}

export function formatDate(date: string, weekday = false) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: weekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function formatWindow(windowStart: string, windowEnd: string) {
  return windowStart === windowEnd
    ? formatDate(windowStart)
    : `${formatDate(windowStart)} to ${formatDate(windowEnd)}`;
}

// Two YYYY-MM-DD days with their weekdays: "Sat, Nov 1 – Fri, Nov 7".
export function formatRange(windowStart: string, windowEnd: string) {
  return windowStart === windowEnd
    ? formatDay(windowStart)
    : `${formatDate(windowStart, true)} – ${formatDate(windowEnd, true)}`;
}

const dayFormat = (timeZone: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  });

const timeFormat = (timeZone: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });

// The current time, refreshed each minute so time-dependent screens move on
// without waiting for data to change.
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

export function formatStart(start: string, timeZone: string) {
  const at = new Date(start);
  return `${dayFormat(timeZone).format(at)}, ${timeFormat(timeZone).format(at)}`;
}

export function formatInterval({ start, end }: Interval, timeZone: string) {
  return `${formatStart(start, timeZone)} to ${timeFormat(timeZone).format(new Date(end))}`;
}

// A YYYY-MM-DD day, written out: "Thursday, Oct 8".
export function formatDay(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function formatTime(start: string, timeZone: string) {
  return timeFormat(timeZone).format(new Date(start));
}
