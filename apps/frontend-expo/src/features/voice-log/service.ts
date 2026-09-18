import { Platform } from "react-native";
import { api } from "@/data/api";
import type {
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

  return (
    await api.post<VoiceLogPreview>("/voice-logs/preview", form)
  ).data;
}

export async function commitVoiceLog(
  payload: VoiceLogCommitRequest,
): Promise<VoiceLogCommitResponse> {
  return (await api.post<VoiceLogCommitResponse>("/voice-logs/commit", payload))
    .data;
}
