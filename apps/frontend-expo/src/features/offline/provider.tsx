import { createContext, useContext, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import axios from "axios";
import { errorMessage } from "@/data/api";
import { logActivity, uploadActivityPhotos, validateLogActivity } from "@/features/activities/service";
import type { ChildrenProps } from "@/core/types";
import { OfflineLogQueue } from "./queue";
import { readQueue, removeStagedPhotos, stagePhotos, writeQueue } from "./storage";
import type { OfflineLogsContextValue, QueuedLog } from "./types";

const Context = createContext<OfflineLogsContextValue | null>(null);

export function OfflineLogsProvider({ children, userId }: ChildrenProps & { userId: string }) {
  const client = useQueryClient();
  const [logs, setLogs] = useState<QueuedLog[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string>();
  const [queue] = useState(() => new OfflineLogQueue({
    read: () => readQueue(userId),
    write: (next) => writeQueue(userId, next),
    send: async (log, checkpoint) => {
      let result;
      if (!log.entryId) {
        result = await logActivity({
          activityId: log.activityId,
          quantity: log.quantity,
          datetime: new Date(log.datetime),
          timezone: log.timezone,
          description: log.description,
          privateNotes: log.privateNotes,
          withUserId: log.withUserId,
          latitude: log.latitude,
          longitude: log.longitude,
          clientRequestId: log.id,
        }, { timeout: 15000 });
      }
      if (log.photos.length) {
        const entryId = log.entryId ?? result!.entry.id;
        if (!log.entryId) await checkpoint(entryId);
        const entry = await uploadActivityPhotos(entryId, log.photos, log.id);
        return { entry, sharedActivityCandidates: result?.sharedActivityCandidates ?? [] };
      }
      return result!;
    },
    isPermanentError: (error) => axios.isAxiosError(error) &&
      !!error.response && error.response.status >= 400 && error.response.status < 500 &&
      ![401, 408, 429].includes(error.response.status),
    message: errorMessage,
    changed: setLogs,
    synced: (log) => {
      void removeStagedPhotos(log.id).catch(() => {});
      void client.invalidateQueries();
    },
  }));

  const sync = (retryErrors = false) => {
    void queue.sync(retryErrors).then(() => setStorageError(undefined))
      .catch((error) => setStorageError(errorMessage(error)));
  };

  useEffect(() => {
    let mounted = true;
    queue.load().then(() => {
      if (mounted) setReady(true);
      sync();
    }).catch((error) => {
      if (mounted) setStorageError(errorMessage(error));
    });
    if (Platform.OS === "web") return () => { mounted = false; queue.close(); };
    const timer = setInterval(() => sync(), 15000);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => { mounted = false; clearInterval(timer); appState.remove(); queue.close(); };
  }, [queue]);

  const value: OfflineLogsContextValue = {
    logs,
    ready,
    storageError,
    save: async (input) => {
      validateLogActivity(input);
      if (Platform.OS === "web")
        return { result: await logActivity(input), queued: false };
      await queue.load();
      const id = randomUUID();
      const photos = await stagePhotos(id, input.photos ?? []);
      const log: QueuedLog = {
        id, activityId: input.activityId, activityTitle: input.activityTitle,
        datetime: input.datetime.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        quantity: input.quantity, description: input.description,
        privateNotes: input.privateNotes, photos, withUserId: input.withUserId,
        latitude: input.latitude, longitude: input.longitude, status: "pending",
      };
      try {
        const result = await queue.enqueue(log);
        const saved = queue.snapshot.find((item) => item.id === id);
        return { result, queued: !result, error: saved?.status === "error" ? saved.error : undefined };
      } catch (error) {
        // A rejected storage write may still have landed. Retain staged
        // photos so a persisted queue can safely resume after a restart.
        setStorageError(errorMessage(error));
        throw error;
      }
    },
    retry: async () => {
      try { await queue.sync(true); setStorageError(undefined); }
      catch (error) { setStorageError(errorMessage(error)); }
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useOfflineLogs() {
  const value = useContext(Context);
  if (!value) throw new Error("Offline log provider is missing");
  return value;
}
