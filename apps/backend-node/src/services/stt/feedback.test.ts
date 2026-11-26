import { describe, expect, it } from "vitest";
import { parseTranscriptionFeedback, transcriptionFeedbackAlert } from "./feedback";

describe("transcription feedback alert", () => {
  it("says who, why, what was heard and what they said", () => {
    const feedback = parseTranscriptionFeedback({
      helpful: false,
      reason: "WRONG_WORDS",
      transcript: "Windowing Chinese daily for like 90 minutes.",
      comment: "I said log 90 minutes for every day I missed",
      model: "openai/gpt-4o-transcribe",
    })!;
    expect(transcriptionFeedbackAlert(feedback, "alex").split("\n")).toEqual([
      "👎 Voice note misheard (wrong words) · alex",
      'Heard: "Windowing Chinese daily for like 90 minutes."',
      "They said: I said log 90 minutes for every day I missed",
      "Model: openai/gpt-4o-transcribe",
    ]);
  });

  it("is one line when nothing else was given", () => {
    expect(transcriptionFeedbackAlert(parseTranscriptionFeedback({ helpful: false })!, "alex")).toBe(
      "👎 Voice note misheard · alex",
    );
  });
});
