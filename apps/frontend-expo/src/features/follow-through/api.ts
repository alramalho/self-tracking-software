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
  });
export const sessionPath = (id: string) =>
  `/follow-through/sessions/${encodeURIComponent(id)}`;
