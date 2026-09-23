import { useAuthFlow } from "./flow";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { resourceCache } from "@clerk/expo/resource-cache";
import Constants from "expo-constants";
import { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { setTokenProvider } from "@/data/api";
import type { ChildrenProps } from "@/core/types";
import type { Session } from "./types";
import { watchBridge } from "@/native/watch/bridge";
import { unregisterIosNotificationsForLogout } from "@/native/notifications";
const Context = createContext<Session | null>(null);
function ClerkSession({ children }: ChildrenProps) {
  const auth = useAuth({ treatPendingAsSignedOut: false });
  const flow = useAuthFlow();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setTokenProvider(() => auth.getToken());
    setReady(auth.isLoaded);
    return () => setTokenProvider(async () => null);
  }, [auth.getToken, auth.isLoaded]);
  return (
    <Context.Provider
      value={{
        userId: auth.userId ?? null,
        isLoaded: ready && flow.isLoaded,
        isSignedIn: !!auth.isSignedIn && flow.isAuthFlowComplete,
        signOut: async () => {
          await Promise.allSettled([
            watchBridge.setAccount(null),
            unregisterIosNotificationsForLogout(),
          ]);
          await auth.signOut();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
function FixtureSession({ children }: ChildrenProps) {
  setTokenProvider(async () => "local-e2e-token");
  return (
    <Context.Provider
      value={{
        userId: "test-user",
        isLoaded: true,
        isSignedIn: true,
        signOut: async () => {},
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function AuthProvider({ children }: ChildrenProps) {
  if (__DEV__ && Constants.expoConfig?.extra?.fixtureMode)
    return <FixtureSession>{children}</FixtureSession>;
  return (
    <ClerkProvider
      publishableKey={Constants.expoConfig?.extra?.clerkPublishableKey}
      tokenCache={tokenCache}
      __experimental_resourceCache={Platform.OS === "web" ? undefined : resourceCache}
    >
      <ClerkSession>{children}</ClerkSession>
    </ClerkProvider>
  );
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error("Session provider is missing");
  return context;
}
