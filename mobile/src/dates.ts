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
