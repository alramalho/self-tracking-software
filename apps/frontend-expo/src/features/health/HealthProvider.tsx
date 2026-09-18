import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/auth/provider";
import { api, backendUrl, getAuthToken } from "@/data/api";
import { useCurrentUser } from "@/data/queries";
import { healthBridge } from "@/native/health/bridge";
import type { AppleHealthStatus } from "@/native/health/types";
import type { ChildrenProps } from "@/core/types";
import type {
  GarminStatus,
  GarminSyncResult,
  HealthContextValue,
} from "./types";
import type { SleepScoresResponse } from "./sleep-types";
import type { WorkoutReconciliationPreview } from "./workout-types";
import { uploadHealth } from "./upload";
import { isTransientHealthError, nextHealthSyncRetryDelay } from "./sync-retry";

const Context = createContext<HealthContextValue | null>(null);
export function useHealth() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing HealthProvider");
  return value;
}

export function HealthProvider({ children }: ChildrenProps) {
  const { userId, isSignedIn } = useSession();
  const user = useCurrentUser(isSignedIn);
  const client = useQueryClient();
  const [available, setAvailable] = useState(false),
    [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  const [garminBusy, setGarminBusy] = useState(false),
    [garminError, setGarminError] = useState<unknown>();
  const [lastGarminSyncResult, setLastGarminSyncResult] =
    useState<GarminSyncResult | null>(null);
  const alive = useRef(true),
    running = useRef(false),
    ready = useRef<Promise<void>>(Promise.resolve()),
    retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    retryAttempt = useRef(0);
  const key = `trackingso:health:${userId}`;
  const status = useQuery({
    queryKey: ["health", "status"],
    enabled: isSignedIn,
    queryFn: async () =>
      (await api.get<AppleHealthStatus>("/health/apple/status")).data,
  });
  const garminStatus = useQuery({
    queryKey: ["health", "garmin-status"],
    enabled: isSignedIn,
    queryFn: async () =>
      (await api.get<GarminStatus>("/health/garmin/status")).data,
  });
  useEffect(() => {
    alive.current = true;
    retryAttempt.current = 0;
    ready.current = (async () => {
      if (!healthBridge) return;
      if (!userId || !isSignedIn) {
        await healthBridge.setAccount(null);
        return;
      }
      await healthBridge.setAccount(userId);
      const device = await healthBridge.isAvailable();
      const optedIn = await AsyncStorage.getItem(key);
      if (optedIn === "true") {
        await healthBridge
          .setWorkoutDetectionEnabled(true)
          .catch(() => undefined);
      }
      if (alive.current) {
        setAvailable(device.available);
        setEnabled(optedIn === "true");
      }
    })().catch((failure) => {
      if (alive.current) setError(failure);
    });
    return () => {
      alive.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = undefined;
    };
  }, [key, userId, isSignedIn]);

  async function runSync(connecting = false, automaticRetry = false) {
    if (running.current) return;
    if (!automaticRetry) {
      retryAttempt.current = 0;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = undefined;
    }
    running.current = true;
    setBusy(true);
    setError(undefined);
    const check = () => {
      if (!alive.current || !userId || !isSignedIn)
        throw new Error(
          "Your account changed. Open Apple Health settings to sync again.",
        );
    };
    try {
      await ready.current;
      check();
      if (!healthBridge || !available)
        throw new Error("Apple Health requires the updated iPhone app.");
      if (!connecting && (await AsyncStorage.getItem(key)) !== "true") return;
      const token = await getAuthToken();
      check();
      if (!token) throw new Error("Sign in again to sync Apple Health.");
      // This client stays bound to this account even if global auth changes mid-upload.
      const uploadClient = axios.create({
        baseURL: backendUrl,
        timeout: 120000,
        headers: { Authorization: `Bearer ${token}` },
      });
      // Re-run authorization for existing connections too. HealthKit does not
      // automatically add read access for newly introduced types such as
      // workout routes after an app update.
      await healthBridge.requestAuthorization();
      check();
      if (connecting) {
        await AsyncStorage.setItem(key, "true");
        setEnabled(true);
        await healthBridge
          .setWorkoutDetectionEnabled(true)
          .catch(() => undefined);
      }
      const prepared = await healthBridge.prepareSync({
        initialLookbackDays: 30,
        refreshLookbackDays: 30,
        ...(typeof user.data?.age === "number" &&
        user.data.age >= 13 &&
        user.data.age <= 100
          ? { estimatedMaxHeartRateBpm: 220 - user.data.age }
          : {}),
      });
      check();
      await uploadHealth(uploadClient, prepared, check);
      await healthBridge.commitSync({ syncToken: prepared.syncToken });
      check();
      retryAttempt.current = 0;
      await client.invalidateQueries({ queryKey: ["health"] });
    } catch (failure) {
      if (alive.current) {
        setError(
          isTransientHealthError(failure)
            ? new Error(
                "Apple Health is temporarily unavailable. We’ll retry automatically.",
              )
            : failure,
        );
        const delay = isTransientHealthError(failure)
          ? nextHealthSyncRetryDelay(retryAttempt.current)
          : null;
        if (delay != null && !retryTimer.current) {
          retryAttempt.current += 1;
          retryTimer.current = setTimeout(() => {
            retryTimer.current = undefined;
            if (alive.current) void syncRef.current(false, true);
          }, delay);
        }
      }
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const syncRef = useRef(runSync);
  syncRef.current = runSync;
  useEffect(() => {
    if (!enabled || !available) return;
    void syncRef.current();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncRef.current();
      }
    });
    return () => listener.remove();
  }, [enabled, available]);

  useEffect(() => {
    if (!isSignedIn) return;
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void garminStatus.refetch();
    });
    return () => listener.remove();
  }, [isSignedIn, garminStatus.refetch]);

  async function disconnect(deleteData: boolean): Promise<boolean> {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError(undefined);
    const check = () => {
      if (!alive.current)
        throw new Error(
          "Your account changed. Open Apple Health settings again.",
        );
    };
    try {
      const token = await getAuthToken();
      check();
      if (!token) throw new Error("Sign in again to disconnect Apple Health.");
      const accountClient = axios.create({
        baseURL: backendUrl,
        timeout: 120000,
        headers: { Authorization: `Bearer ${token}` },
      });
      await AsyncStorage.removeItem(key);
      check();
      setEnabled(false);
      await healthBridge
        ?.setWorkoutDetectionEnabled(false)
        .catch(() => undefined);
      await accountClient.delete("/health/apple", { params: { deleteData } });
      check();
      await healthBridge?.resetSync();
      check();
      client.setQueryData<WorkoutReconciliationPreview>(
        ["health", "workouts"],
        (previous) =>
          previous
            ? {
                ...previous,
                items: [],
                summary: { ...previous.summary, pending: 0 },
              }
            : previous,
      );
      if (deleteData)
        client.setQueryData<SleepScoresResponse>(
          ["health", "sleep"],
          (previous) => (previous ? { ...previous, scores: [] } : previous),
        );
      await client.invalidateQueries({ queryKey: ["health"] });
      if (deleteData)
        await Promise.all(
          ["activities", "activity-entries", "timeline", "plans"].map((key) =>
            client.invalidateQueries({ queryKey: [key] }),
          ),
        );
      return true;
    } catch (failure) {
      if (alive.current) setError(failure);
      return false;
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function connectGarmin(): Promise<void> {
    setGarminBusy(true);
    setGarminError(undefined);
    try {
      const returnUrl = Linking.createURL("garmin/callback");
      const authorizationUrl = (
        await api.get<{ authorizationUrl: string }>("/health/garmin/connect", {
          params: { returnUrl },
        })
      ).data.authorizationUrl;
      await WebBrowser.openAuthSessionAsync(authorizationUrl, returnUrl);
      await garminStatus.refetch();
    } catch (failure) {
      setGarminError(failure);
    } finally {
      setGarminBusy(false);
    }
  }

  async function syncGarmin(): Promise<void> {
    setGarminBusy(true);
    setGarminError(undefined);
    try {
      const response = await api.post<{ result: GarminSyncResult }>(
        "/health/garmin/sync",
        {
          days: 7,
          backfillDays: 180,
          forceBackfill:
            (garminStatus.data?.importStats.workoutCount ?? 0) === 0,
        },
      );
      setLastGarminSyncResult(response.data.result);
      await Promise.all([
        garminStatus.refetch(),
        client.invalidateQueries({ queryKey: ["health"] }),
      ]);
    } catch (failure) {
      setGarminError(failure);
    } finally {
      setGarminBusy(false);
    }
  }

  async function disconnectGarmin(deleteData: boolean): Promise<boolean> {
    if (garminBusy) return false;
    setGarminBusy(true);
    setGarminError(undefined);
    try {
      await api.delete("/health/garmin", { params: { deleteData } });
      setLastGarminSyncResult(null);
      await Promise.all([
        garminStatus.refetch(),
        client.invalidateQueries({ queryKey: ["health"] }),
        ...(deleteData
          ? [
              client.invalidateQueries({ queryKey: ["activities"] }),
              client.invalidateQueries({ queryKey: ["activity-entries"] }),
              client.invalidateQueries({ queryKey: ["timeline"] }),
              client.invalidateQueries({ queryKey: ["plans"] }),
            ]
          : []),
      ]);
      return true;
    } catch (failure) {
      setGarminError(failure);
      return false;
    } finally {
      setGarminBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        available,
        enabled,
        busy,
        error: error ?? status.error,
        status: status.data,
        connect: () => runSync(true),
        sync: () => runSync(),
        disconnect,
        garmin: {
          status: garminStatus.data,
          lastSyncResult: lastGarminSyncResult,
          busy: garminBusy,
          error: garminError ?? garminStatus.error,
          connect: connectGarmin,
          sync: syncGarmin,
          disconnect: disconnectGarmin,
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
