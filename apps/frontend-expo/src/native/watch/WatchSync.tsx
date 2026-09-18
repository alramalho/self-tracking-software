import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useSession } from "@/auth/provider";
import { api } from "@/data/api";
import { watchBridge } from "./bridge";
import type { WatchTokens } from "./types";

export function WatchSync() {
  const { isSignedIn, userId } = useSession();
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const account = isSignedIn ? userId : null;
    let cancelled = false;
    let pending = false;
    const sync = async () => {
      if (!account || cancelled || pending) return;
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
  }, [isSignedIn, userId]);
  return null;
}
