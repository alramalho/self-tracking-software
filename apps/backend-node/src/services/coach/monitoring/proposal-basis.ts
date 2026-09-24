import { createHash } from "node:crypto";
import type { ActiveCoachPlan } from "../types";

/** A proposal must still describe the plan the person is reviewing. */
export function planProposalBasis(plan: ActiveCoachPlan) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: plan.id,
        goal: plan.goal,
        goalReason: plan.goalReason,
        notes: plan.notes,
        outlineType: plan.outlineType,
        timesPerWeek: plan.timesPerWeek,
        finishingDate: plan.finishingDate,
        isPaused: plan.isPaused,
        archivedAt: plan.archivedAt,
        deletedAt: plan.deletedAt,
        activities: plan.activities.map((a) => a.id).sort(),
        sessions: [...plan.sessions].sort((a, b) => a.id.localeCompare(b.id)),
        milestones: [...plan.milestones].sort((a, b) =>
          a.id.localeCompare(b.id),
        ),
      }),
    )
    .digest("hex");
}
export class StaleCoachProposalError extends Error {
  constructor() {
    super(
      "This plan changed after the suggestion. Ask your coach to review the current plan before applying it.",
    );
  }
}
