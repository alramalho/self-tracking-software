import type { LogActivityResult } from "@/core/types";
import type { QueuedLog } from "./types";

export interface QueueDependencies {
  read: () => Promise<QueuedLog[]>;
  write: (logs: QueuedLog[]) => Promise<void>;
  send: (log: QueuedLog, checkpoint: (entryId: string) => Promise<void>) => Promise<LogActivityResult>;
  isPermanentError: (error: unknown) => boolean;
  message: (error: unknown) => string;
  changed: (logs: QueuedLog[]) => void;
  synced: (log: QueuedLog, result: LogActivityResult) => void;
}

export class OfflineLogQueue {
  private logs: QueuedLog[] = [];
  private loadPromise?: Promise<void>;
  private writeLock: Promise<void> = Promise.resolve();
  private syncPromise?: Promise<Map<string, LogActivityResult>>;
  private active = true;

  constructor(private readonly deps: QueueDependencies) {}

  get snapshot() { return this.logs; }

  close() { this.active = false; }

  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.deps.read().then((logs) => {
        this.logs = logs;
        if (this.active) this.deps.changed(logs);
      }).catch((error) => {
        this.loadPromise = undefined;
        throw error;
      });
    }
    return this.loadPromise;
  }

  private mutate(change: (logs: QueuedLog[]) => QueuedLog[]): Promise<void> {
    const next = this.writeLock.then(async () => {
      const logs = change(this.logs);
      try {
        await this.deps.write(logs);
      } catch (error) {
        // An AsyncStorage write can fail after a request has reached the server.
        // Keep the record eligible for an idempotent retry in this app session.
        this.logs = this.logs.map((item) => item.status === "syncing"
          ? { ...item, status: "pending" } : item);
        if (this.active) this.deps.changed(this.logs);
        throw error;
      }
      this.logs = logs;
      if (this.active) this.deps.changed(logs);
    });
    this.writeLock = next.catch(() => {});
    return next;
  }

  async enqueue(log: QueuedLog): Promise<LogActivityResult | undefined> {
    await this.load();
    await this.mutate((logs) => [...logs, log]);
    try {
      const results = await this.sync();
      return results.get(log.id);
    } catch {
      // The local copy already exists. Keep its staged files and let retry
      // recover from the failed status/checkpoint/removal write.
      return undefined;
    }
  }

  async sync(includeErrors = false): Promise<Map<string, LogActivityResult>> {
    await this.load();
    if (this.syncPromise) return this.syncPromise;
    const promise = this.run(includeErrors);
    this.syncPromise = promise;
    try { return await promise; }
    finally { if (this.syncPromise === promise) this.syncPromise = undefined; }
  }

  private async run(includeErrors: boolean): Promise<Map<string, LogActivityResult>> {
    const results = new Map<string, LogActivityResult>();
    const attempted = new Set<string>();
    while (this.active) {
      const log = this.logs.find((item) => !attempted.has(item.id) &&
        (item.status === "pending" || (includeErrors && item.status === "error")));
      if (!log) break;
      attempted.add(log.id);
      await this.mutate((logs) => logs.map((item) => item.id === log.id
        ? { ...item, status: "syncing" as const, error: undefined } : item));
      if (!this.active) break;
      try {
        const result = await this.deps.send(log, (entryId) =>
          this.mutate((logs) => logs.map((item) => item.id === log.id ? { ...item, entryId } : item)));
        await this.mutate((logs) => logs.filter((item) => item.id !== log.id));
        results.set(log.id, result);
        this.deps.synced(log, result);
      } catch (error) {
        const permanent = this.deps.isPermanentError(error);
        await this.mutate((logs) => logs.map((item) => item.id === log.id
          ? { ...item, status: permanent ? "error" as const : "pending" as const,
              error: this.deps.message(error) } : item));
        // Preserve user order: a failed earlier log remains ahead of later logs.
        break;
      }
    }
    return results;
  }
}
