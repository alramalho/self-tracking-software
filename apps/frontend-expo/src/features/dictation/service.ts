import { Platform } from "react-native";
import { api } from "@/data/api";
import type { TranscriptionResponse } from "./types";

const recordingFormat = Platform.OS === "web" ? "webm" : "m4a";
const recordingMimeType =
  recordingFormat === "webm" ? "audio/webm" : "audio/mp4";

export async function transcribeRecording(uri: string): Promise<string> {
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
  const transcript = response.data.text.trim();
  if (!transcript)
    throw new Error("I couldn’t hear an answer. Please try again.");
  return transcript;
}
