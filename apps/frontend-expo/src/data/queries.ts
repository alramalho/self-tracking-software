import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "./api";
import type {
  Activity,
  ActivityEntry,
  Metric,
  MetricEntry,
  Plan,
  TimelinePage,
  User,
} from "@/core/types";
export const useCurrentUser = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["current-user"],
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    queryFn: async () => (await api.get<User>("/users/user")).data,
  });
export const useActivities = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["activities"],
    queryFn: async () => (await api.get<Activity[]>("/activities")).data,
  });
export const useEntries = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["activity-entries"],
    queryFn: async () =>
      (await api.get<ActivityEntry[]>("/activities/activity-entries")).data,
  });
export const usePlans = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["plans"],
    queryFn: async () => (await api.get<Plan[]>("/plans")).data,
  });
export const useMetrics = () =>
  useQuery({
    queryKey: ["metrics"],
    queryFn: async () => (await api.get<Metric[]>("/metrics")).data,
  });
export const useMetricEntries = () =>
  useQuery({
    queryKey: ["metric-entries"],
    queryFn: async () =>
      (await api.get<MetricEntry[]>("/metrics/entries")).data,
  });
export const useProfile = (username?: string, id?: string) =>
  useQuery({
    queryKey: ["profile", username ?? id],
    enabled: !!username || !!id,
    queryFn: async () =>
      (
        await api.post<User>("/users/get-user", {
          identifiers: [id ? { id } : { username }],
        })
      ).data,
  });
export const usePlan = (id?: string) =>
  useQuery({
    queryKey: ["plan", id],
    enabled: !!id,
    queryFn: async () =>
      (await api.get<Plan>(`/plans/${id}?includeActivities=true`)).data,
  });
export const useTimeline = () =>
  useInfiniteQuery({
    queryKey: ["timeline"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      (
        await api.get<TimelinePage>("/users/timeline", {
          params: { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
        })
      ).data,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
// All activity mutations affect profile history, heatmaps, home cards and plan progress.
export function useAction<T>(mutationFn: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await client.invalidateQueries();
    },
  });
}

export const useContextEvents = () =>
  useQuery({
    queryKey: ["context-events"],
    queryFn: async () =>
      (
        await api.get<{
          events: import("@/features/metrics/types").MetricContextEvent[];
        }>("/context-events")
      ).data.events,
  });
