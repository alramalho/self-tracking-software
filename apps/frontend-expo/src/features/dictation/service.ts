import { Platform } from "react-native";
import { api } from "@/data/api";
import type { User } from "@/core/types";
import type {
  Transcription,
  TranscriptionFeedbackInput,
  TranscriptionResponse,
} from "./types";

const recordingFormat = Platform.OS === "web" ? "webm" : "m4a";
const recordingMimeType =
  recordingFormat === "webm" ? "audio/webm" : "audio/mp4";

export async function transcribeRecording(
  uri: string,
): Promise<Transcription> {
  const form = new FormData();

  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("audio_file", blob, `answer.${recordingFormat}`);
  } else {
    form.append("audio_file", {
      uri,
      name: `answer.${recordingFormat}`,
      type: recordingMimeType,
    } as unknown as Blob);
  }

  form.append("audio_format", recordingFormat);
  const response = await api.post<TranscriptionResponse>(
    "/ai/transcribe",
    form,
  );
  const text = response.data.text.trim();
  if (!text) throw new Error("I couldn’t hear an answer. Please try again.");
  return { text, language: response.data.language, model: response.data.model };
}

export async function sendTranscriptionFeedback(
  feedback: TranscriptionFeedbackInput,
) {
  await api.post("/ai/transcribe/feedback", feedback);
}

// Main language first. Speech to text listens for these from the next recording on.
export async function saveSpokenLanguages(spokenLanguages: string[]) {
  return (await api.patch<User>("/users/user", { spokenLanguages })).data;
}
