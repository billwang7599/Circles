import type {
  CircleView,
  CreateCircle,
  CreatePlan,
  EditPlan,
  JoinCircle,
  Lock,
  Me,
  MembershipResponse,
  PlanView,
  RegistrationInput,
  Vote,
} from "@circles/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";
import { clearToken, getToken, setToken } from "./session";

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
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(baseUrl + path, {
      method,
      headers,
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the server");
  }
  if (res.status === 401) await clearToken();
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
  circle: (id: string) => ["circles", id] as const,
  plan: (circleId: string, planId: string) =>
    ["circles", circleId, "plans", planId] as const,
};

// Every 5 s, until the server refuses (gone, forbidden, signed out).
const polling = {
  refetchInterval: (query: { state: { error: Error | null } }) =>
    isRefusal(query.state.error) ? false : 5000,
};

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async (): Promise<Me> => {
      if (!(await getToken())) return { circles: [] };
      try {
        return await request<Me>("/api/me");
      } catch (error) {
        // The account is gone; request() already dropped the token.
        if (error instanceof ApiError && error.status === 401)
          return { circles: [] };
        throw error;
      }
    },
    ...polling,
  });
}

export function useCircle(id: string) {
  return useQuery({
    queryKey: keys.circle(id),
    queryFn: () => request<CircleView>(`/api/circles/${id}`),
    ...polling,
  });
}

function useMembership<Body extends object>(path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Body) => request<MembershipResponse>(path, body),
    // A stale token is dropped by request(); the retry creates a fresh account.
    retry: (count, error) =>
      error instanceof ApiError && error.status === 401 && count < 1,
    onSuccess: async ({ token }) => {
      if (token) await setToken(token);
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export const useCreateCircle = () =>
  useMembership<CreateCircle>("/api/circles");
export const useJoinCircle = () =>
  useMembership<JoinCircle>("/api/circles/join");

export function usePlan(circleId: string, planId: string) {
  return useQuery({
    queryKey: keys.plan(circleId, planId),
    queryFn: () =>
      request<PlanView>(`/api/circles/${circleId}/plans/${planId}`),
    ...polling,
  });
}

function usePlanMutation<Body = void>(
  circleId: string,
  mutationFn: (body: Body) => Promise<PlanView>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (view) => {
      const key = keys.plan(circleId, view.plan.id);
      // A poll already in flight would land after this and show older state.
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData(key, view);
      // Not awaited: the screen moves on while the lists catch up.
      void queryClient.invalidateQueries({
        queryKey: keys.circle(circleId),
        exact: true,
      });
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
    // A refused action usually means the screen is stale: show what is true now.
    onError: () =>
      queryClient.invalidateQueries({ queryKey: keys.circle(circleId) }),
  });
}

export const useCreatePlan = (circleId: string) =>
  usePlanMutation(circleId, (body: CreatePlan) =>
    request<PlanView>(`/api/circles/${circleId}/plans`, body),
  );
export const useEditPlan = (circleId: string, planId: string) =>
  usePlanMutation(circleId, (body: EditPlan) =>
    request<PlanView>(`/api/circles/${circleId}/plans/${planId}`, body, "PUT"),
  );
export const useSaveRegistration = (circleId: string, planId: string) =>
  usePlanMutation(circleId, (body: RegistrationInput) =>
    request<PlanView>(
      `/api/circles/${circleId}/plans/${planId}/registration`,
      body,
      "PUT",
    ),
  );
export const useGenerateOptions = (circleId: string, planId: string) =>
  usePlanMutation(circleId, () =>
    request<PlanView>(
      `/api/circles/${circleId}/plans/${planId}/options`,
      undefined,
      "POST",
    ),
  );
export const useVote = (circleId: string, planId: string) =>
  usePlanMutation(circleId, (body: Vote) =>
    request<PlanView>(
      `/api/circles/${circleId}/plans/${planId}/vote`,
      body,
      "PUT",
    ),
  );
export const useLock = (circleId: string, planId: string) =>
  usePlanMutation(circleId, (body: Lock) =>
    request<PlanView>(`/api/circles/${circleId}/plans/${planId}/lock`, body),
  );
export const useUnlock = (circleId: string, planId: string) =>
  usePlanMutation(circleId, () =>
    request<PlanView>(
      `/api/circles/${circleId}/plans/${planId}/lock`,
      undefined,
      "DELETE",
    ),
  );

export function useDeletePlan(circleId: string, planId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<{ ok: true }>(
        `/api/circles/${circleId}/plans/${planId}`,
        undefined,
        "DELETE",
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: keys.circle(circleId),
        exact: true,
      });
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useLeaveCircle(circleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request<{ ok: true }>(
        `/api/circles/${circleId}/members/me`,
        undefined,
        "DELETE",
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}
