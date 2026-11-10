import type {
  AnswersLink,
  ClaimInvite,
  ClaimResult,
  CreateEvent,
  DateWindow,
  EditEvent,
  EventView,
  MakeItineraries,
  Me,
  ReadDates,
  UpdateName,
} from "@circles/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useRef } from "react";
import { NativeModules, Platform } from "react-native";
import { accessToken, forgetSession } from "./session";

const scriptUrl: string | undefined =
  NativeModules.SourceCode?.getConstants?.().scriptURL;

const devHost =
  Constants.expoConfig?.hostUri?.split(":")[0] ??
  (scriptUrl ? new URL(scriptUrl).hostname : undefined) ??
  (__DEV__ && Platform.OS === "web" ? window.location.hostname : undefined);

const baseUrl =
  process.env.EXPO_PUBLIC_API_URL ?? (devHost ? `http://${devHost}:3001` : "");

// The server answered with an error, as opposed to not being reachable.
class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// A refusal is final and replaces what the screen shows; a server failure or
// an unreachable server is retried and the screen keeps what it has.
export const isRefusal = (error: unknown) =>
  error instanceof ApiError && error.status < 500;

async function request<T>(
  path: string,
  body?: object,
  method: "GET" | "POST" | "PUT" | "DELETE" = body ? "POST" : "GET",
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    const token = await accessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    res = await fetch(baseUrl + path, {
      method,
      headers,
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the server");
  }
  if (res.status === 401) forgetSession();
  if (!res.headers.get("content-type")?.includes("application/json"))
    throw new Error("Can't reach the server");
  const json: unknown = await res.json();
  if (!res.ok)
    throw new ApiError(
      (json as { error?: string }).error ?? "Something went wrong, try again",
      res.status,
    );
  return json as T;
}

const keys = {
  me: ["me"] as const,
  event: (id: string) => ["events", id] as const,
};

// Every 5 s, until the server refuses (gone, forbidden, signed out).
const polling = {
  refetchInterval: (query: { state: { error: Error | null } }) =>
    isRefusal(query.state.error) ? false : 5000,
};

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => request<Me>("/api/me"),
    ...polling,
  });
}

export function useSaveName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateName) =>
      request<UpdateName>("/api/me/name", body, "PUT"),
    onSuccess: ({ displayName }) => {
      queryClient.setQueryData<Me>(
        keys.me,
        (me) => me && { ...me, displayName },
      );
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

// A date range in the organizer's words, read on the server.
export function useReadDates() {
  return useMutation({
    mutationFn: (body: ReadDates) => request<DateWindow>("/api/dates", body),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateEvent) => request<EventView>("/api/events", body),
    onSuccess: (view) => {
      queryClient.setQueryData(keys.event(view.event.id), view);
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

const fetchEvent = (id: string) => request<EventView>(`/api/events/${id}`);

// The model takes minutes over the options, longer than a request stays
// open, so the server answers at once and makes them on its own time. The
// cards are normally saved within a few seconds, so the screen looks often
// while they are pending, but never for longer than a make can take.
const makingPollMs = 1500;
const makingMaxMs = 8 * 60_000;

// Looks often while the server is still writing an option's days, which
// land one card at a time; a card left waiting past what a make can take
// does not hold the screen on the fast loop.
export function useEvent(id: string) {
  const pendingSince = useRef<number>(undefined);
  return useQuery({
    queryKey: keys.event(id),
    queryFn: () => fetchEvent(id),
    refetchInterval: (query) => {
      if (isRefusal(query.state.error)) return false;
      const pending =
        query.state.data?.itineraries.some((i) => i.daysPending) ?? false;
      if (!pending) {
        pendingSince.current = undefined;
        return 5000;
      }
      pendingSince.current ??= Date.now();
      return Date.now() - pendingSince.current < makingMaxMs
        ? makingPollMs
        : 5000;
    },
  });
}

// The result is the event's new view, written straight into the cache so
// the screen never shows older state.
export function useEditEvent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: EditEvent) =>
      request<EventView>(`/api/events/${id}`, body, "PUT"),
    onSuccess: async (view) => {
      // A poll already in flight would land after this and show older state.
      await queryClient.cancelQueries({ queryKey: keys.event(id) });
      queryClient.setQueryData(keys.event(id), view);
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
    // A refused edit usually means the screen is stale: show what is true now.
    onError: () => queryClient.invalidateQueries({ queryKey: keys.event(id) }),
  });
}

export function useDeleteEvent(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<{ ok: true }>(`/api/events/${id}`, undefined, "DELETE"),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: keys.event(id) });
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Pending until the event carries options it did not have, each fetch
// landing in the cache the screen reads, or until the wait is up; their days
// follow on the event's own polling. A refused request means the event
// changed under the screen: show what is true now.
export function useMakeItineraries(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: MakeItineraries) => {
      const queryKey = keys.event(id);
      const had = new Set(
        queryClient
          .getQueryData<EventView>(queryKey)
          ?.itineraries.map((itinerary) => itinerary.id),
      );
      await request<{ ok: true }>(`/api/events/${id}/itineraries`, body);
      for (let waited = 0; waited < makingMaxMs; waited += makingPollMs) {
        await wait(makingPollMs);
        const view = await queryClient
          .fetchQuery({ queryKey, queryFn: () => fetchEvent(id) })
          .catch((error: unknown) => {
            // The server being unreachable for a moment is no reason to stop.
            if (isRefusal(error)) throw error;
            return undefined;
          });
        if (view?.itineraries.some((itinerary) => !had.has(itinerary.id)))
          return;
      }
      throw new Error("Taking too long, try again");
    },
    onError: () => queryClient.invalidateQueries({ queryKey: keys.event(id) }),
  });
}

// A fresh link to this account's own answers page for the event.
export function useAnswersLink(id: string) {
  return useMutation({
    mutationFn: () =>
      request<AnswersLink>(`/api/events/${id}/answers-link`, {}),
  });
}

// Answers given from the invite link follow the account into the event.
export function useClaimInvite(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ClaimInvite) =>
      request<ClaimResult>(`/api/invites/${slug}/claim`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}
