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

const REASON_LABEL: Record<TranscriptionFeedbackReason, string> = {
  WRONG_LANGUAGE: "wrong language",
  WRONG_WORDS: "wrong words",
  OTHER: "other",
};

/** The Telegram alert for a thumbs down, so a misheard voice note is looked at the same day. */
export function transcriptionFeedbackAlert(feedback: TranscriptionFeedback, who: string): string {
  const reason = feedback.reason ? ` (${REASON_LABEL[feedback.reason]})` : "";
  return [
    `👎 Voice note misheard${reason} · ${who}`,
    feedback.transcript ? `Heard: "${feedback.transcript.slice(0, 600)}"` : null,
    feedback.comment ? `They said: ${feedback.comment.slice(0, 600)}` : null,
    feedback.model ? `Model: ${feedback.model}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
