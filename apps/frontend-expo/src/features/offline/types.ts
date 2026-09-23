import type { LogActivityInput, LogActivityResult, Photo } from "@/core/types";

export interface QueuedLog {
  id: string;
  activityId: string;
  activityTitle: string;
  entryId?: string;
  datetime: string;
  timezone: string;
  quantity: number;
  description?: string;
  privateNotes?: string;
  withUserId?: string;
  latitude?: number;
  longitude?: number;
  photos: Photo[];
  status: "pending" | "syncing" | "error";
  error?: string;
}

export interface OfflineLogInput extends LogActivityInput {
  activityTitle: string;
}

export interface OfflineLogOutcome {
  result?: LogActivityResult;
  queued: boolean;
  error?: string;
}

export interface OfflineLogsContextValue {
  logs: QueuedLog[];
  ready: boolean;
  storageError?: string;
  save: (input: OfflineLogInput) => Promise<OfflineLogOutcome>;
  retry: () => Promise<void>;
}
