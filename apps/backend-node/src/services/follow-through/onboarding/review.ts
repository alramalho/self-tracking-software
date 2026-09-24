import { createHash } from "node:crypto";
import type { OnboardingDraft } from "@tsw/prisma/follow-through";

// Submitted answers only, never keystrokes, device data, or whole request bodies.
// Keep original wording so a reviewer can compare it with the extracted facts.
export function onboardingReviewEvents(userId: string, draft: OnboardingDraft, previous?: OnboardingDraft | null) {
  const before = previous?.id === draft.id ? previous.interview?.turns ?? [] : [];
  return (draft.interview?.turns ?? []).flatMap((turn, index) => {
    if (JSON.stringify(turn) === JSON.stringify(before[index])) return [];
    const eventId = createHash("sha256").update(JSON.stringify([userId, draft.id, index, turn])).digest("hex");
    return [{
      event: "onboarding.answer_saved", version: 1, eventId, userId,
      draftId: draft.id, turnIndex: index, source: "submitted_draft",
      stage: turn.stage, question: turn.question, answer: turn.answer,
      accepted: turn.accepted, feedback: turn.feedback,
      facts: draft.interview!.facts,
    }];
  });
}
