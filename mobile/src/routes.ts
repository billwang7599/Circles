// Where the app's screens live, as typed route strings.
export const eventHref = (eventId: string) => `/events/${eventId}` as const;
export const newEventHref = "/events/new";
export const profileHref = "/profile";
