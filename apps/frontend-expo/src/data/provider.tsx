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
import { OfflineLogsProvider } from "@/features/offline/provider";
export function DataProvider({ children }: ChildrenProps) {
  const session = useSession();
  const userId = session.isSignedIn ? session.userId : null;
  return <AccountDataProvider key={userId ?? "signed-out"} userId={userId}>{children}</AccountDataProvider>;
}

function AccountDataProvider({ children, userId }: ChildrenProps & { userId: string | null }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30000, gcTime: Infinity, retry: 1 },
          mutations: { retry: false },
        },
      }),
  );
  const [persister] = useState(() =>
    createAsyncStoragePersister({
      storage: AsyncStorage,
      key: `trackingso:queries:${userId ?? "signed-out"}`,
    }),
  );
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = AppState.addEventListener("change", (state) =>
      focusManager.setFocused(state === "active"),
    );
    return () => sub.remove();
  }, []);
  if (!userId)
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: Infinity,
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
              "timeline",
            ].includes(String(query.queryKey[0])),
        },
      }}
    >
      <EntitlementRefresh />
      <OfflineLogsProvider userId={userId}>{children}</OfflineLogsProvider>
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
