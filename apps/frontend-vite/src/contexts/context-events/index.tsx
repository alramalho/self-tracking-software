import { useApiWithAuth } from "@/api";
import { useSession } from "@/contexts/auth";
import { useQuery } from "@tanstack/react-query";
import { getContextEvents } from "./service";

export function useContextEvents(enabled = true) {
  const api = useApiWithAuth();
  const { isSignedIn, isLoaded } = useSession();

  return useQuery({
    queryKey: ["context-events"],
    queryFn: () => getContextEvents(api),
    enabled: enabled && isLoaded && !!isSignedIn,
    staleTime: 1000 * 60 * 5,
  });
}

export type { UserContextEvent } from "./service";
