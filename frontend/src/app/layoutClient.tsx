"use client";

import { useSession } from "@clerk/clerk-react";
import BottomNav from "../components/BottomNav";
import { Toaster } from "react-hot-toast";
import { Toaster as SonnerToaster } from "sonner";
import { UserPlanProviderWrapper } from "@/components/UserPlanProviderWrapper";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import GeneralInitializer from "@/components/GeneralInitializer";
import { cn } from "@/lib/utils";
import { LoggerProvider } from "@/components/LoggerProvider";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UpgradeProvider } from "@/contexts/UpgradeContext";
import { PlanProgressProvider } from "@/contexts/PlanProgressContext";
import { DailyCheckinPopoverProvider } from "@/contexts/DailyCheckinContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ZeroProviderWrapper } from "@/components/ZeroProviderWrapper";

// Configure QueryClient with longer gcTime to support persistence
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Set a longer garbage collection time to keep cached data
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 30 * 1000, // 30 seconds
    },
  },
});

const localStoragePersister = createSyncStoragePersister({
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
    // <PersistQueryClientProvider
    <QueryClientProvider
      client={queryClient}
      // persistOptions={{ persister: localStoragePersister }}
    >
      <ZeroProviderWrapper>
        <LoggerProvider>
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
        </LoggerProvider>
      </ZeroProviderWrapper>
    </QueryClientProvider>
  );
}
