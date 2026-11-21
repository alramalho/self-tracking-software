import { appendFile } from "node:fs/promises";
import path from "node:path";

/**
 * Moments where someone got a worse experience than they should have: the coach fell back or failed,
 * a chat reply was cut off, a voice note didn't go through. One JSON line each, next to AI_USAGE_LOG on
 * the host like the voice-note samples, read back by the analytics page's Rough edges card. ROUGH_EDGES
 * overrides the file; "off" disables it.
 */
export const ROUGH_EDGE_LABELS = {
  coach_fallback: "Coach skipped its reply tool",
  coach_retry: "Coach reply rejected, retried",
  coach_failed: "Coach couldn't reply",
  chat_interrupted: "Chat reply cut off",
  chat_failed: "Chat message failed",
  voice_note_failed: "Voice note failed",
} as const;

export type RoughEdgeKind = keyof typeof ROUGH_EDGE_LABELS;

/** What the app may report about itself; the coach kinds only come from the server. */
export const CLIENT_ROUGH_EDGES: RoughEdgeKind[] = ["chat_interrupted", "chat_failed", "voice_note_failed"];

export type RoughEdge = { at: string; kind: RoughEdgeKind; userId: string; detail?: string };

export function roughEdgesFile(env = process.env): string | null {
  if (env.ROUGH_EDGES === "off") return null;
  if (env.ROUGH_EDGES) return env.ROUGH_EDGES;
  return env.AI_USAGE_LOG ? path.join(path.dirname(env.AI_USAGE_LOG), "rough-edges.jsonl") : null;
}

const PER_HOUR = 20;
const recentByUser = new Map<string, number[]>();

/** Never throws and never slows the request down. A user can add at most 20 an hour. */
export function recordRoughEdge(edge: { kind: RoughEdgeKind; userId: string; detail?: string }) {
  const file = roughEdgesFile();
  if (!file) return;
  const now = Date.now();
  const times = (recentByUser.get(edge.userId) ?? []).filter((t) => now - t < 3_600_000);
  if (times.length >= PER_HOUR) return;
  recentByUser.set(edge.userId, [...times, now]);
  const line: RoughEdge = {
    at: new Date(now).toISOString(),
    kind: edge.kind,
    userId: edge.userId,
    ...(edge.detail ? { detail: edge.detail.slice(0, 300) } : {}),
  };
  void appendFile(file, `${JSON.stringify(line)}\n`).catch(() => {});
}
