import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import type { RankingsResponse } from "./types";
export function useRankings() {
  return useQuery({
    queryKey: ["rankings"],
    staleTime: 300000,
    queryFn: async () =>
      (await api.get<RankingsResponse>("/users/rankings")).data,
  });
}
