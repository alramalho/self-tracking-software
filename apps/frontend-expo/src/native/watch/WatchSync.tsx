import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useSession } from "@/auth/provider";
import { api } from "@/data/api";
import { watchBridge } from "./bridge";
import type { WatchTokens } from "./types";

export function WatchSync() {
  const { isLoaded, isSignedIn, userId } = useSession();
  useEffect(() => {
    // Signing out detaches the watch explicitly (see leaveActiveAccount). Until the
    // session has loaded, "not signed in" only means "not known yet", and must not
    // sign the watch out on every app launch.
    if (Platform.OS !== "ios" || !isLoaded || !isSignedIn || !userId) return;
    const account = userId;
    let cancelled = false;
    let pending = false;
    const sync = async () => {
      if (cancelled || pending) return;
      pending = true;
      try {
        const { data } = await api.post<WatchTokens>("/auth/watch-tokens");
        if (!cancelled) await watchBridge.sendTokens(account, data.accessToken, data.refreshToken);
      } catch {
        // Preserve working watch credentials offline; retry on foreground or timer.
      } finally { pending = false; }
    };
    void watchBridge.setAccount(account).then(sync);
    const foreground = AppState.addEventListener("change", state => {
      if (state === "active") void sync();
    });
    const timer = setInterval(() => void sync(), 30 * 60 * 1000);
    return () => { cancelled = true; foreground.remove(); clearInterval(timer); };
  }, [isLoaded, isSignedIn, userId]);
  return null;
}
