import { createHash } from "node:crypto";

// A phone that goes to the background drops its connection while the coach is still
// designing. The work carries on here; when the app asks again with the same answers,
// it gets that same design (still running, or finished) instead of waiting all over again.
const KEPT_MS = 15 * 60 * 1000;
const running = new Map<string, { result: Promise<unknown>; startedAt: number }>();

export function sharedRequest<T>(userId: string, input: unknown, work: () => Promise<T>): Promise<T> {
  const now = Date.now();
  for (const [key, entry] of running) if (now - entry.startedAt > KEPT_MS) running.delete(key);
  const key = createHash("sha256").update(userId).update(JSON.stringify(input)).digest("hex");
  const existing = running.get(key);
  if (existing) return existing.result as Promise<T>;
  const result = work();
  running.set(key, { result, startedAt: now });
  // A failed design is not kept: asking again should try again.
  result.catch(() => running.delete(key));
  return result;
}
