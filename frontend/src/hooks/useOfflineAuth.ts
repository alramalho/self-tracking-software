"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "@clerk/nextjs";
import { useLocalStorage } from "./useLocalStorage";
import { toast } from "react-hot-toast";
import { hasCachedUserData } from "@/contexts/UserPlanContext";

interface CachedSessionState {
  isSignedIn: boolean;
  userId: string | null;
  timestamp: number;
}

const SESSION_CACHE_DURATION = 5 * 24 * 60 * 60 * 1000; // 5 days
const CACHE_UPDATE_THROTTLE = 5 * 60 * 1000; // Only update cache every 5 minutes if no significant changes

const isSessionCacheValid = (cached: CachedSessionState | null): boolean => {
  if (!cached) return false;
  const isExpired = Date.now() - cached.timestamp > SESSION_CACHE_DURATION;
  return !isExpired;
};

export const useOfflineAuth = () => {
  const { isSignedIn, isLoaded: isClerkLoaded, session } = useSession();
  const [isOnline, setIsOnline] = useState(true);
  const [cachedSession, setCachedSession] =
    useLocalStorage<CachedSessionState | null>("clerk-session-cache", null);
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);

  // Track the last cached values to avoid unnecessary writes
  const lastCachedRef = useRef<{
    isSignedIn: boolean;
    userId: string | null;
  }>({ isSignedIn: false, userId: null });

  // Track online/offline status
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);

      const handleOnline = () => {
        setIsOnline(true);
        setHasShownOfflineToast(false); // Reset toast flag when back online
      };
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  // Cache session state when online and authenticated - OPTIMIZED
  useEffect(() => {
    // Only run when we have a stable online connection and Clerk is loaded
    if (!isOnline || !isClerkLoaded) return;

    const currentUserId = session?.user?.id || null;
    const currentIsSignedIn = isSignedIn;

    // Check if the session data has actually changed
    const hasSessionChanged =
      lastCachedRef.current.isSignedIn !== currentIsSignedIn ||
      lastCachedRef.current.userId !== currentUserId;

    // Check if enough time has passed for a routine update (5 minutes)
    const shouldUpdateByTime =
      cachedSession &&
      Date.now() - cachedSession.timestamp > CACHE_UPDATE_THROTTLE;

    // Only update cache if session changed OR it's been a while since last update
    if (hasSessionChanged || shouldUpdateByTime) {
      const newCacheData: CachedSessionState = {
        isSignedIn: currentIsSignedIn,
        userId: currentUserId,
        timestamp: Date.now(),
      };

      setCachedSession(newCacheData);

      // Update our reference to track what we just cached
      lastCachedRef.current = {
        isSignedIn: currentIsSignedIn,
        userId: currentUserId,
      };

      // Only log significant changes (not routine timestamp updates)
      if (hasSessionChanged) {
        console.debug("[OfflineAuth] Session cache updated:", {
          isSignedIn: currentIsSignedIn,
          userId: currentUserId ? `${currentUserId.substring(0, 8)}...` : null,
        });
      }
    }
  }, [isOnline, isClerkLoaded, isSignedIn, session?.user?.id]); // Removed setCachedSession from deps

  // Show offline toast when going offline with valid cached session
  useEffect(() => {
    if (
      !isOnline &&
      !hasShownOfflineToast &&
      isSessionCacheValid(cachedSession) &&
      hasCachedUserData()
    ) {
      toast("You're offline. Using cached data.", {
        icon: "📱",
        duration: 3000,
      });
      setHasShownOfflineToast(true);
    }
  }, [isOnline, hasShownOfflineToast, cachedSession]);

  // Determine effective auth state
  const effectiveIsSignedIn = isOnline
    ? isSignedIn
    : isSessionCacheValid(cachedSession)
    ? cachedSession?.isSignedIn ?? false
    : false;

  const effectiveIsLoaded = isOnline ? isClerkLoaded : cachedSession !== null;

  const effectiveUserId = isOnline
    ? session?.user?.id
    : isSessionCacheValid(cachedSession)
    ? cachedSession?.userId
    : null;

  const isOfflineMode =
    !isOnline &&
    isSessionCacheValid(cachedSession) &&
    cachedSession?.isSignedIn;

  return {
    isSignedIn: effectiveIsSignedIn,
    isLoaded: effectiveIsLoaded,
    userId: effectiveUserId,
    isOnline,
    isOfflineMode,
    hasValidCache: isSessionCacheValid(cachedSession) && hasCachedUserData(),
  };
};
