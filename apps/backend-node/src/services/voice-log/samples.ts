import { appendFile } from "node:fs/promises";
import path from "node:path";
import { s3Service } from "../s3Service";
import { logger } from "../../utils/logger";

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

/**
 * Keeps the recording in S3 (users/<id>/voice-notes/, so deleting the account deletes it) to replay misheard notes
 * against new speech-to-text setups later. Off unless VOICE_RECORDINGS=store: the privacy policy has to say we keep
 * them first. Runs in the background and never fails the voice note. Returns the key, or null when off.
 */
export function storeVoiceRecording(input: {
  userId: string;
  clientRequestId: string;
  audioBytes: Buffer;
  audioFormat?: string;
}, env = process.env): string | null {
  if (env.VOICE_RECORDINGS !== "store") return null;
  const format = input.audioFormat === "webm" ? "webm" : "m4a";
  const key = `users/${input.userId}/voice-notes/${new Date().toISOString().replace(/[:.]/g, "-")}-${input.clientRequestId}.${format}`;
  void s3Service
    .upload(input.audioBytes, key, format === "webm" ? "audio/webm" : "audio/mp4")
    .catch((error) => logger.error("Could not store the voice recording", error));
  return key;
}
