"use client";

import GeneralInitializer from "@/components/GeneralInitializer";
import { UserPlanProviderWrapper } from "@/components/UserPlanProviderWrapper";
import { DailyCheckinPopoverProvider } from "@/contexts/DailyCheckinContext";
import { PlanProgressProvider } from "@/contexts/PlanProgressContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UpgradeProvider } from "@/contexts/UpgradeContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { useSession } from "@clerk/clerk-react";
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from "react-hot-toast";
import { Toaster as SonnerToaster } from "sonner";

// Configure QueryClient with longer gcTime to support persistence
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Set a longer garbage collection time to keep cached data
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const localStoragePersister = createAsyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "TRACKING_SO_QUERY_CACHE",
  throttleTime: 1000,
});

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isSignedIn } = useSession(); // Removed isLoaded as it's not used directly here
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <PersistQueryClientProvider
      // <QueryClientProvider
      client={queryClient}
      persistOptions={{ persister: localStoragePersister }}
    >
      <UserPlanProviderWrapper>
        <PlanProgressProvider>
          <ThemeProvider>
            <UpgradeProvider>
              <DailyCheckinPopoverProvider>
                <NotificationsProvider>
                  <main
                    className={cn(
                      "relative h-[100dvh] [background-image:linear-gradient(#f0f0f0_1px,transparent_1px),linear-gradient(to_right,#f0f0f0_1px,#f5f5f5_1px)] [background-size:20px_20px] flex flex-col items-center justify-center p-4",
                      isSignedIn && isDesktop ? "ml-64" : ""
                    )}
                  >
                    <GeneralInitializer>{children}</GeneralInitializer>
                  </main>
                  <SonnerToaster position="top-center" />
                  <Toaster
                    position="top-center"
                    containerStyle={{
                      bottom: "5rem",
                      zIndex: 105,
                    }}
                  />
                </NotificationsProvider>
              </DailyCheckinPopoverProvider>
            </UpgradeProvider>
          </ThemeProvider>
        </PlanProgressProvider>
      </UserPlanProviderWrapper>
    </PersistQueryClientProvider>
  );
}
