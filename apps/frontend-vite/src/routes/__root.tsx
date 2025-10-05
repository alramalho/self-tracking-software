import GeneralInitializer from "@/components/GeneralInitializer";
import { GlobalDataProvider } from "@/contexts/GlobalDataProvider";
import { ThemeProvider } from "@/contexts/theme/provider";
import { UpgradeProvider } from "@/contexts/upgrade/provider";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Toaster } from "react-hot-toast";
import { Toaster as SonnerToaster } from "sonner";

// Configure QueryClient with longer gcTime to support persistence
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (for persistence)
      staleTime: 1000 * 60 * 30, // 30 minutes
      retry: 3,
    },
  },
});

const localStoragePersister = createAsyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "TRACKING_SO_QUERY_CACHE",
  throttleTime: 1000,
});

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      signInUrl="/signin"
      signUpUrl="/signup"
      afterSignOutUrl="/signin"
    >
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: localStoragePersister }}
      >
        <GlobalDataProvider>
          <ThemedLayout />
        </GlobalDataProvider>
      </PersistQueryClientProvider>
    </ClerkProvider>
  );
}

function ThemedLayout() {
  const { isSignedIn } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <ThemeProvider>
      <UpgradeProvider>
        <NotificationsProvider>
          <main
            className={cn(
              "relative h-[100dvh] bg-white flex flex-col items-center justify-center p-4 z-10 bg-transparent",
              isSignedIn && isDesktop ? "ml-64" : ""
            )}
          >
            <GeneralInitializer>
              <Outlet />
            </GeneralInitializer>
          </main>
          <SonnerToaster position="top-center" />
          <Toaster
            position="top-center"
            containerStyle={{
              bottom: "5rem",
              zIndex: 105,
            }}
          />
          <TanStackRouterDevtools />
        </NotificationsProvider>
      </UpgradeProvider>
    </ThemeProvider>
  );
}
