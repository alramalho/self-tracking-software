import { useAuthFlow } from "./flow";
import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import axios from "axios";
import Constants from "expo-constants";
import { createContext, useContext, useEffect, useState } from "react";
import { api, setTokenProvider } from "@/data/api";
import type { ChildrenProps } from "@/core/types";
import type { RememberedAccount, Session } from "./types";
import { forget, listAccounts, remember, toAccount } from "./accounts";
import {
  loadRememberedAccounts,
  saveRememberedAccounts,
} from "./rememberedAccounts";
import { watchBridge } from "@/native/watch/bridge";
import { unregisterIosNotificationsForLogout } from "@/native/notifications";
import { resetAnalytics } from "@/analytics/client";
import { widgetBridge } from "@/native/widgets/bridge";
const Context = createContext<Session | null>(null);
/** Detaches this device from the active account before another one takes over. */
function leaveActiveAccount() {
  return Promise.allSettled([
    widgetBridge.setAccount(null),
    watchBridge.setAccount(null),
    unregisterIosNotificationsForLogout(),
  ]);
}
// Clerk holds one session at a time. The other accounts on this device are
// remembered as switch tokens, which the backend trades for a sign-in ticket.
function ClerkSession({ children }: ChildrenProps) {
  const auth = useAuth({ treatPendingAsSignedOut: false });
  const clerk = useClerk();
  const { user } = useUser();
  const flow = useAuthFlow();
  const [ready, setReady] = useState(false);
  const [remembered, setRemembered] = useState<RememberedAccount[] | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const active = user ? toAccount(user) : null;
  const isSignedIn = !!auth.isSignedIn && flow.isAuthFlowComplete;
  useEffect(() => {
    setTokenProvider(() => auth.getToken());
    setReady(auth.isLoaded);
    return () => setTokenProvider(async () => null);
  }, [auth.getToken, auth.isLoaded]);
  useEffect(() => {
    void loadRememberedAccounts().then(setRemembered);
  }, []);

  const updateRemembered = async (
    change: (accounts: RememberedAccount[]) => RememberedAccount[],
  ) => {
    const next = change(await loadRememberedAccounts());
    await saveRememberedAccounts(next);
    setRemembered(next);
    return next;
  };
  /** Keeps the active account on this device, so it can be switched back to. */
  const rememberActive = async () => {
    if (!active) return;
    const stored = (await loadRememberedAccounts()).find(
      (account) => account.userId === active.userId,
    );
    const switchToken: string =
      stored?.switchToken ??
      (await api.post("/auth/switch-tokens")).data.switchToken;
    await updateRemembered((accounts) =>
      remember(accounts, { ...active, switchToken }),
    );
  };
  const logOut = async () => {
    await leaveActiveAccount();
    await auth.signOut();
  };
  /** Signs this device into a remembered account, replacing whoever is active. */
  const activate = async (account: RememberedAccount) => {
    const ticket: string = await api
      .post("/auth/switch", { switchToken: account.switchToken })
      .then((response) => response.data.ticket)
      .catch(async (error) => {
        // The server no longer accepts this token; the account needs a real sign-in.
        if (axios.isAxiosError(error) && error.response?.status === 401)
          await updateRemembered((accounts) => forget(accounts, account.userId));
        throw error;
      });
    setSwitchingTo(account.userId);
    try {
      await logOut();
      const signIn = await clerk.client!.signIn.create({
        strategy: "ticket",
        ticket,
      });
      // Accounts that need a second factor cannot be switched to silently.
      if (!signIn.createdSessionId)
        throw new Error(`Sign in to ${account.name} again.`);
      await clerk.setActive({ session: signIn.createdSessionId });
    } catch (error) {
      setSwitchingTo(null);
      throw error;
    }
  };

  // Once this device holds more than one account, each one that signs in is remembered.
  useEffect(() => {
    if (isSignedIn && remembered?.length) void rememberActive().catch(() => {});
  }, [isSignedIn, active?.userId, remembered === null]);
  // Clerk's native layer hears about a switch a moment after JS does, so the
  // loading screen stays up until it has, instead of flashing the sign-in screen.
  useEffect(() => {
    if (!switchingTo) return;
    if (isSignedIn && auth.userId === switchingTo) return setSwitchingTo(null);
    const giveUp = setTimeout(() => setSwitchingTo(null), 10000);
    return () => clearTimeout(giveUp);
  }, [switchingTo, isSignedIn, auth.userId]);

  return (
    <Context.Provider
      value={{
        userId: auth.userId ?? null,
        isLoaded:
          ready && flow.isLoaded && remembered !== null && !switchingTo,
        isSignedIn,
        accounts: listAccounts(active, remembered ?? []),
        switchAccount: async (userId) => {
          const target = remembered?.find((account) => account.userId === userId);
          if (!target || userId === auth.userId) return;
          await rememberActive();
          await activate(target);
        },
        addAccount: async () => {
          await rememberActive();
          await logOut();
        },
        signOut: async () => {
          const leaving = remembered?.find(
            (account) => account.userId === auth.userId,
          );
          const [next] = await updateRemembered((accounts) =>
            forget(accounts, auth.userId ?? null),
          );
          if (leaving)
            await api
              .post("/auth/switch-tokens/revoke", {
                switchToken: leaving.switchToken,
              })
              .catch(() => {});
          // If the next account cannot take over, this is still a plain logout.
          if (next) await activate(next).catch(logOut);
          else await logOut();
          resetAnalytics();
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
        accounts: [],
        switchAccount: async () => {},
        addAccount: async () => {},
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
