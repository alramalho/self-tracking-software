import { useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import type { FollowThroughSnapshot } from "@tsw/prisma/follow-through";
export const useFollowThrough = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: ["follow-through"],
    queryFn: async () =>
      (await api.get<FollowThroughSnapshot>("/follow-through")).data,
    staleTime: 15000,
    refetchInterval: query => query.state.data?.state.monitoring?.setupPlanIds?.some(id =>
      query.state.data?.state.supports[id]?.coaching?.role === "training") ? 5000 : false,
  });
export const sessionPath = (id: string) =>
  `/follow-through/sessions/${encodeURIComponent(id)}`;
