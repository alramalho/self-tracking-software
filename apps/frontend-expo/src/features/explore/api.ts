import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import type { RecommendedUsers, SearchPerson } from "./types";

export const useRecommendedUsers = () =>
  useQuery({
    queryKey: ["recommendations"],
    queryFn: async () => (await api.get<RecommendedUsers>("/users/recommended-users")).data,
    staleTime: 5 * 60 * 1000,
  });

// Only your own connections; strangers come from recommendations.
export const useConnectionSearch = (query: string) =>
  useQuery({
    enabled: query.length > 0,
    queryKey: ["people-search-v2", query],
    queryFn: async ({ signal }) =>
      (await api.get<SearchPerson[]>(`/users/search-users/${encodeURIComponent(query)}`, { signal })).data,
  });
