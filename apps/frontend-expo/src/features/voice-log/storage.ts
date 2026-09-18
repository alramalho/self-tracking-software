import AsyncStorage from "@react-native-async-storage/async-storage";
import type { VoiceLogDraft } from "./types";

const PENDING_VOICE_LOG_KEY = "tracking.so.pending-voice-log.v1";

function isDraft(value: unknown): value is VoiceLogDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<VoiceLogDraft>;
  return !!candidate.preview &&
    Array.isArray(candidate.selectedActivityKeys) &&
    Array.isArray(candidate.selectedMetricKeys) &&
    typeof candidate.savedAt === "string";
}

export async function readPendingVoiceLog() {
  const value = await AsyncStorage.getItem(PENDING_VOICE_LOG_KEY);
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writePendingVoiceLog(draft: VoiceLogDraft) {
  await AsyncStorage.setItem(PENDING_VOICE_LOG_KEY, JSON.stringify(draft));
}

export async function clearPendingVoiceLog() {
  await AsyncStorage.removeItem(PENDING_VOICE_LOG_KEY);
}
