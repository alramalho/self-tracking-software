import { createHash } from "node:crypto";
import type { OnboardingDraft } from "@tsw/prisma/follow-through";

// Submitted answers only, never keystrokes, device data, or whole request bodies.
// Logs reach Better Stack: stage, outcome and sizes, never the wording or facts.
export function onboardingReviewEvents(userId: string, draft: OnboardingDraft, previous?: OnboardingDraft | null) {
  const before = previous?.id === draft.id ? previous.interview?.turns ?? [] : [];
  const facts = draft.interview?.facts ?? {};
  return (draft.interview?.turns ?? []).flatMap((turn, index) => {
    if (JSON.stringify(turn) === JSON.stringify(before[index])) return [];
    const eventId = createHash("sha256").update(JSON.stringify([userId, draft.id, index, turn])).digest("hex");
    return [{
      event: "onboarding.answer_saved", version: 2, eventId, userId,
      draftId: draft.id, turnIndex: index, source: "submitted_draft",
      stage: turn.stage, accepted: turn.accepted,
      answerLength: turn.answer?.length ?? 0,
      factsFilled: Object.values(facts).filter((value) => value != null && value !== "" && !(Array.isArray(value) && !value.length)).length,
    }];
  });
}
