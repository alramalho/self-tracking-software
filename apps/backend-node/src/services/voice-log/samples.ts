import { appendFile } from "node:fs/promises";
import path from "node:path";

/**
 * Every voice-log preview and commit as one JSON line (transcript, the catalog the model saw, what it extracted,
 * and what the person finally saved), so failed voice notes can be read back and turned into benchmark cases
 * (scripts/voice-log-bench). Written next to AI_USAGE_LOG on the host (it survives redeploys and never goes to
 * the log shipper). VOICE_LOG_SAMPLES overrides the file; "off" disables it.
 */
export function voiceLogSamplesFile(env = process.env): string | null {
  if (env.VOICE_LOG_SAMPLES === "off") return null;
  if (env.VOICE_LOG_SAMPLES) return env.VOICE_LOG_SAMPLES;
  return env.AI_USAGE_LOG ? path.join(path.dirname(env.AI_USAGE_LOG), "voice-logs.jsonl") : null;
}

export function recordVoiceLogSample(sample: Record<string, unknown>) {
  const file = voiceLogSamplesFile();
  if (!file) return;
  const line = JSON.stringify({ at: new Date().toISOString(), ...sample });
  void appendFile(file, `${line}\n`).catch(() => {});
}
