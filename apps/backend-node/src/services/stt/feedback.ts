import { languageCode } from "./languages";
import type { TranscriptionFeedback, TranscriptionFeedbackReason } from "./types";

const REASONS: TranscriptionFeedbackReason[] = [
  "WRONG_LANGUAGE",
  "WRONG_WORDS",
  "OTHER",
];
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : undefined;

// What the app may send as feedback on a dictation result. Returns null when it
// doesn't say whether the transcription was right. A thumbs up keeps no transcript.
export function parseTranscriptionFeedback(
  body: any,
): TranscriptionFeedback | null {
  if (typeof body?.helpful !== "boolean") return null;
  const feedback: TranscriptionFeedback = {
    helpful: body.helpful,
    language: languageCode(text(body.language, 20)),
    model: text(body.model, 100),
  };
  if (body.helpful) return feedback;
  return {
    ...feedback,
    reason: REASONS.includes(body.reason) ? body.reason : undefined,
    comment: text(body.comment, 2000),
    transcript: text(body.transcript, 5000),
  };
}
