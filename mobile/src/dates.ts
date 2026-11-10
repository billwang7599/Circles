import { localDate, type EventSummary } from "@circles/shared";

// The device's IANA timezone; Hermes can leave it empty.
export const deviceTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

// This device's calendar day, YYYY-MM-DD.
export const todayKey = () => localDate(new Date(), deviceTimezone());

// A YYYY-MM-DD day written out, "Thursday, Dec 11"; read in UTC so the day
// never shifts.
export const formatDay = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));

// An event is past once its window has ended.
export const isPast = (event: EventSummary, today: string) =>
  event.windowEnd < today;
