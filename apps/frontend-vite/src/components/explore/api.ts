import { useApiWithAuth } from "@/api";
import { useQuery } from "@tanstack/react-query";
import type { RecommendedUsers, SearchPerson } from "./types";

export const useRecommendedUsers = () => {
  const api = useApiWithAuth();
  return useQuery({
    queryKey: ["recommendations"],
    queryFn: async () => (await api.get<RecommendedUsers>("/users/recommended-users")).data,
    staleTime: 1000 * 60 * 5,
  });
};

// Only your own connections; strangers come from recommendations.
export const useConnectionSearch = (query: string) => {
  const api = useApiWithAuth();
  return useQuery({
    enabled: query.length > 0,
    queryKey: ["people-search", query],
    queryFn: async ({ signal }) =>
      (await api.get<SearchPerson[]>(`/users/search-users/${encodeURIComponent(query)}`, { signal })).data,
  });
};
