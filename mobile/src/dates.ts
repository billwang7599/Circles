import type { Interval } from "@circles/shared";
import { useEffect, useState } from "react";

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
