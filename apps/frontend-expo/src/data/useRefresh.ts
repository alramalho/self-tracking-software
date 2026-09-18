import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// A pull gesture owns the spinner. Background cache updates do not start it,
// and it stays visible until all data displayed by this screen has refreshed.
export function useRefresh(...queryNames: string[]) {
  const client = useQueryClient();
  const names = useRef(queryNames);
  names.current = queryNames;
  const pending = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setRefreshing(true);
    try {
      await client.refetchQueries({
        type: "active",
        predicate: (query) => names.current.includes(String(query.queryKey[0])),
      });
    } finally {
      pending.current = false;
      setRefreshing(false);
    }
  }, [client]);
  return { refresh, refreshing };
}
