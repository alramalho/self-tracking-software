import GeneralInitializer from "@/components/GeneralInitializer";
import { GlobalErrorComponent } from "@/components/GlobalErrorComponent";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { GlobalDataProvider } from "@/contexts/GlobalDataProvider";
import { ThemeProvider } from "@/contexts/theme/provider";
import { useTheme } from "@/contexts/theme/useTheme";
import { UpgradeProvider } from "@/contexts/upgrade/provider";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createRootRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { Home, Squirrel } from "lucide-react";
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

function NotFoundComponent() {
  const navigate = useNavigate();
  return (
    <div className="min-h-full bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <Squirrel className="w-24 h-24 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Oops. Page not found
          </h1>
          <p className="text-muted-foreground">How did you even get here?</p>
        </div>

        <div className="space-y-3">
          <Button className="w-full" onClick={() => navigate({ to: "/" })}>
            <Home className="w-4 h-4 mr-2" />
            Go back home
          </Button>
        </div>
      </div>
    </div>
  );
}



export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: GlobalErrorComponent,
});

function RootComponent() {
  return (
    <AuthProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: localStoragePersister }}
      >
        <GlobalDataProvider>
          <ThemedLayout />
        </GlobalDataProvider>
      </PersistQueryClientProvider>
    </AuthProvider>
  );
}

function ThemedLayout() {
  const { isSignedIn } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const location = useLocation();
  const isDownloadPage = location.pathname.startsWith("/download");

  return (
    <ThemeProvider>
      <ToasterComponents isSignedIn={isSignedIn} isDesktop={isDesktop} isDownloadPage={isDownloadPage} />
    </ThemeProvider>
  );
}

function ToasterComponents({ isSignedIn, isDesktop, isDownloadPage }: { isSignedIn: boolean, isDesktop: boolean, isDownloadPage: boolean }) {
  const { effectiveThemeMode } = useTheme();

  return (
    <UpgradeProvider>
      <NotificationsProvider>
        <main
          className={cn(
            "relative h-[100dvh] bg-white flex flex-col items-center justify-center p-4 z-10 bg-transparent",
            (isSignedIn && isDesktop && !isDownloadPage) ? "ml-64" : ""
          )}
        >
          <GeneralInitializer>
            <Outlet />
          </GeneralInitializer>
        </main>
        <SonnerToaster
          position="top-center"
          theme={effectiveThemeMode}
        />
        <Toaster
          position="top-center"
          containerStyle={{
            bottom: "5rem",
            zIndex: 105,
          }}
          toastOptions={{
            style: {
              background: effectiveThemeMode === 'dark' ? '#000000' : '#ffffff',
              color: effectiveThemeMode === 'dark' ? '#ffffff' : '#000000',
              border: `1px solid hsl(var(--border))`,
            },
          }}
        />
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </NotificationsProvider>
    </UpgradeProvider>
  );
}
