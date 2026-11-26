import { Platform } from "react-native";
import { api } from "@/data/api";
import { reportingFailures } from "@/data/roughEdges";
import type {
  VoiceLogCoverage,
  VoiceLogCoverageRequest,
  VoiceLogCommitRequest,
  VoiceLogCommitResponse,
  VoiceLogPreview,
  PreviewVoiceLogOptions,
} from "./types";

const recordingFormat = Platform.OS === "web" ? "webm" : "m4a";
const recordingMimeType =
  recordingFormat === "webm" ? "audio/webm" : "audio/mp4";

export async function previewVoiceLog(
  uri: string,
  options: PreviewVoiceLogOptions,
): Promise<VoiceLogPreview> {
  const form = new FormData();

  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("audio_file", blob, `voice-note.${recordingFormat}`);
  } else {
    form.append(
      "audio_file",
      {
        uri,
        name: `voice-note.${recordingFormat}`,
        type: recordingMimeType,
      } as unknown as Blob,
    );
  }

  form.append("audio_format", recordingFormat);
  form.append("timezone", options.timezone);
  form.append("client_request_id", options.clientRequestId);
  if (options.refinementContext) {
    form.append(
      "refinement_context",
      JSON.stringify(options.refinementContext),
    );
  }
  if (options.focusActivityId) {
    form.append("focus_activity_id", options.focusActivityId);
  }
  if (options.followUpContext) {
    form.append("follow_up_context", JSON.stringify(options.followUpContext));
  }

  return reportingFailures("voice_note_failed", async () =>
    (await api.post<VoiceLogPreview>("/voice-logs/preview", form)).data,
  );
}

export async function commitVoiceLog(
  payload: VoiceLogCommitRequest,
): Promise<VoiceLogCommitResponse> {
  return reportingFailures("voice_note_failed", async () =>
    (await api.post<VoiceLogCommitResponse>("/voice-logs/commit", payload)).data,
  );
}

/** "Yes, log it" on a gone-quiet alert, once the logs are saved: the alert is answered for the week. */
export async function markCaughtUp(planId: string) {
  await api.post(`/follow-through/plans/${encodeURIComponent(planId)}/caught-up`, {});
}

/** After a "What did you cover?" note on a learning plan: the coach's read, and a suggested change when there is one. */
export async function checkCoverage(payload: VoiceLogCoverageRequest): Promise<VoiceLogCoverage | null> {
  return (await api.post<{ coverage: VoiceLogCoverage | null }>("/voice-logs/coverage", payload, { timeout: 60000 })).data.coverage;
}
