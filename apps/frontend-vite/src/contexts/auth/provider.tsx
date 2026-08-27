import { setAuthTokenProvider } from "@/lib/api";
import { authService } from "@/services/auth";
import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  useAuth as useClerkAuth,
  useClerk,
  useSignIn,
} from "@clerk/clerk-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthContextType, NativeAuthTokens, WatchAuthPlugin } from "./types";

const WatchAuth = registerPlugin<WatchAuthPlugin>("WatchAuth");
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const clerkAuth = useClerkAuth();
  const { signOut: clerkSignOut } = useClerk();
  const { isLoaded: isSignInLoaded, signIn, setActive } = useSignIn();
  const [isNativeAuthLoading, setIsNativeAuthLoading] = useState(false);

  useEffect(() => {
    setAuthTokenProvider(() => clerkAuth.getToken());
    return () => setAuthTokenProvider(async () => null);
  }, [clerkAuth.getToken]);

  useEffect(() => {
    void authService.initializeSocialLogin().catch((error) => {
      console.error("Failed to initialize native social login", error);
    });
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !clerkAuth.isSignedIn) return;

    const sendWatchTokens = async () => {
      const accessToken = await clerkAuth.getToken();
      if (!accessToken) return;

      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
      const response = await fetch(`${backendUrl}/auth/watch-tokens`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return;

      const tokens = (await response.json()) as NativeAuthTokens;
      await WatchAuth.sendTokens(tokens);
    };

    void sendWatchTokens().catch(() => {});
  }, [clerkAuth.isSignedIn, clerkAuth.sessionId]);

  const completeNativeSignIn = async (ticket: string) => {
    if (!isSignInLoaded || !signIn || !setActive) {
      throw new Error("Authentication is still loading");
    }

    const result = await signIn.create({ strategy: "ticket", ticket });
    if (result.status !== "complete" || !result.createdSessionId) {
      throw new Error("Clerk did not complete the native sign-in");
    }
    await setActive({ session: result.createdSessionId });
  };

  const signInWithGoogle = async () => {
    setIsNativeAuthLoading(true);
    try {
      await completeNativeSignIn(await authService.getGoogleSignInTicket());
    } finally {
      setIsNativeAuthLoading(false);
    }
  };

  const signInWithApple = async () => {
    setIsNativeAuthLoading(true);
    try {
      await completeNativeSignIn(await authService.getAppleSignInTicket());
    } finally {
      setIsNativeAuthLoading(false);
    }
  };

  const signOut = async () => {
    if (Capacitor.isNativePlatform()) {
      await WatchAuth.clearTokens().catch(() => {});
    }
    await clerkSignOut();
  };

  const value = useMemo<AuthContextType>(
    () => ({
      userId: clerkAuth.userId ?? null,
      isLoading: !clerkAuth.isLoaded || isNativeAuthLoading,
      isLoaded: clerkAuth.isLoaded,
      isSignedIn: Boolean(clerkAuth.isSignedIn),
      signInWithGoogle,
      signInWithApple,
      signOut,
      getToken: clerkAuth.getToken,
    }),
    [clerkAuth, isNativeAuthLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

export const useSession = useAuth;
export const useUser = useAuth;
