import type { DesignProgress } from "@tsw/prisma/follow-through";

// What the app shows while it waits: each stage of one design request, kept for a while
// so a phone that comes back from the background can catch up.
const KEPT_MS = 15 * 60 * 1000;
const stages = new Map<string, { progress: DesignProgress; updatedAt: number }>();
const keyOf = (userId: string, progressId: string) => `${userId}:${progressId}`;

export function recordProgress(userId: string, progressId: string, progress: DesignProgress) {
  const now = Date.now();
  for (const [key, entry] of stages) if (now - entry.updatedAt > KEPT_MS) stages.delete(key);
  stages.set(keyOf(userId, progressId), { progress: { ...progress }, updatedAt: now });
}

export const readProgress = (userId: string, progressId: string): DesignProgress | null =>
  stages.get(keyOf(userId, progressId))?.progress ?? null;
