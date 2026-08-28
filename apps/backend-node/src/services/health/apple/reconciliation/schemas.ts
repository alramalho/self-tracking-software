import { z } from "zod/v4";

import { WORKOUT_RECONCILIATION_ACTIONS } from "./types";

const boundedId = z.string().trim().min(1).max(100);

export const workoutReconciliationDecisionSchema = z
  .object({
    healthWorkoutId: boundedId,
    action: z.enum(WORKOUT_RECONCILIATION_ACTIONS),
    activityEntryId: boundedId.optional(),
    activityId: boundedId.optional(),
  })
  .superRefine((decision, context) => {
    if (
      (decision.action === "link_keep" ||
        decision.action === "link_use_health") &&
      !decision.activityEntryId
    ) {
      context.addIssue({
        code: "custom",
        path: ["activityEntryId"],
        message: "Link actions require an activity entry",
      });
    }
  });
export const workoutReconciliationRequestSchema = z
  .object({
    decisions: z
      .array(workoutReconciliationDecisionSchema)
      .min(1)
      .max(250),
  })
  .superRefine((request, context) => {
    const seenWorkoutIds = new Set<string>();
    request.decisions.forEach((decision, index) => {
      if (seenWorkoutIds.has(decision.healthWorkoutId)) {
        context.addIssue({
          code: "custom",
          path: ["decisions", index, "healthWorkoutId"],
          message: "Each Health workout can only be confirmed once",
        });
      }
      seenWorkoutIds.add(decision.healthWorkoutId);
    });
  });
