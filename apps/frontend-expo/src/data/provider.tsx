import { useCurrentUser } from "./queries";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { useSession } from "@/auth/provider";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import type { ChildrenProps } from "@/core/types";
export function DataProvider({ children }: ChildrenProps) {
  const session = useSession();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, gcTime: 24 * 60 * 60 * 1000, retry: 1 },
          mutations: { retry: false },
        },
      }),
  );
  const [persister] = useState(() =>
    createAsyncStoragePersister({
      storage: AsyncStorage,
      key: `trackingso:queries:${session.userId ?? "signed-out"}`,
    }),
  );
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) =>
      focusManager.setFocused(state === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(
    () => () => {
      client.clear();
      void persister.removeClient();
    },
    [client, persister],
  );
  if (!session.isSignedIn)
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: "expo-v1",
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" &&
            [
              "current-user",
              "activities",
              "activity-entries",
              "plans",
              "metrics",
              "metric-entries",
            ].includes(String(query.queryKey[0])),
        },
      }}
    >
      <EntitlementRefresh />
      {children}
    </PersistQueryClientProvider>
  );
}

// A verified account upgrade updates every mounted screen, including cached coaching gates.
function EntitlementRefresh() {
  const user = useCurrentUser(), client = useQueryClient();
  const previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    const plan = user.data?.planType;
    if (!plan) return;
    if (previous.current && previous.current !== plan)
      void client.invalidateQueries({ predicate: query => query.queryKey[0] !== "current-user" });
    previous.current = plan;
  }, [user.data?.planType, client]);
  return null;
}
