import type {
  CircleView,
  CreateCircle,
  CreatePlan,
  JoinCircle,
  Me,
  MembershipResponse,
  PlanView,
  RegistrationInput,
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

export const baseUrl =
  process.env.EXPO_PUBLIC_API_URL ?? (devHost ? `http://${devHost}:3001` : "");

async function request<T>(
  path: string,
  body?: object,
  method: "GET" | "POST" | "PUT" = body ? "POST" : "GET",
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
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (json as { error?: string }).error ?? `Request failed (${res.status})`,
    );
  return json as T;
}

const keys = {
  me: ["me"] as const,
  circle: (id: string) => ["circles", id] as const,
  plan: (circleId: string, planId: string) =>
    ["circles", circleId, "plans", planId] as const,
};

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async (): Promise<Me> =>
      (await getToken()) ? request<Me>("/api/me") : { circles: [] },
  });
}

export function useCircle(id: string) {
  return useQuery({
    queryKey: keys.circle(id),
    queryFn: () => request<CircleView>(`/api/circles/${id}`),
    refetchInterval: 5000,
  });
}

function useMembership<Body extends object>(path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Body) => request<MembershipResponse>(path, body),
    onSuccess: async ({ token }) => {
      if (token) await setToken(token);
      await queryClient.invalidateQueries({ queryKey: keys.me });
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
    refetchInterval: 5000,
  });
}

function usePlanMutation<Body extends object>(
  circleId: string,
  mutationFn: (body: Body) => Promise<PlanView>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (view) => {
      queryClient.setQueryData(keys.plan(circleId, view.plan.id), view);
      return queryClient.invalidateQueries({
        queryKey: keys.circle(circleId),
        exact: true,
      });
    },
  });
}

export const useCreatePlan = (circleId: string) =>
  usePlanMutation(circleId, (body: CreatePlan) =>
    request<PlanView>(`/api/circles/${circleId}/plans`, body),
  );
export const useSaveRegistration = (circleId: string, planId: string) =>
  usePlanMutation(circleId, (body: RegistrationInput) =>
    request<PlanView>(
      `/api/circles/${circleId}/plans/${planId}/registration`,
      body,
      "PUT",
    ),
  );
