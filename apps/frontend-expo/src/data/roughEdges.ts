import { api } from "./api";

type RoughEdgeKind = "chat_interrupted" | "chat_failed" | "voice_note_failed";

// Failures the person actually saw, for the analytics page's Rough edges card. A dropped connection is often the
// failure itself, so reports wait in memory and go out with the next request that works.
const waiting: { kind: RoughEdgeKind; detail?: string }[] = [];
let flushing = false;

function describe(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return [status, message].filter(Boolean).join(" ").slice(0, 200) || undefined;
}

/** Sign-in, paywall and permission answers aren't rough edges: the app handles those on purpose. */
function expected(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 402 || status === 403;
}

export function reportRoughEdge(kind: RoughEdgeKind, error?: unknown) {
  if (expected(error)) return;
  if (waiting.length < 20) waiting.push({ kind, detail: describe(error) });
  void flushRoughEdges();
}

export async function flushRoughEdges() {
  if (flushing) return;
  flushing = true;
  try {
    while (waiting.length) {
      await api.post("/rough-edges", waiting[0]);
      waiting.shift();
    }
  } catch {
    // Still offline: try again after the next request that works.
  } finally {
    flushing = false;
  }
}

/** Runs a request; reports it if it fails (and rethrows), sends waiting reports if it works. */
export async function reportingFailures<T>(
  kind: RoughEdgeKind | ((error: unknown) => RoughEdgeKind),
  run: () => Promise<T>,
): Promise<T> {
  try {
    const result = await run();
    if (waiting.length) void flushRoughEdges();
    return result;
  } catch (error) {
    reportRoughEdge(typeof kind === "function" ? kind(error) : kind, error);
    throw error;
  }
}
