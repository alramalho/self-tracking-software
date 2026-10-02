import { z } from "zod/v4";

import { WORKOUT_RECONCILIATION_ACTIONS } from "./types";

const boundedId = z.string().trim().min(1).max(100);

export const workoutReconciliationDecisionSchema = z
  .object({
    healthWorkoutId: boundedId,
    action: z.enum(WORKOUT_RECONCILIATION_ACTIONS),
    activityEntryId: boundedId.optional(),
    activityId: boundedId.optional(),
    shareHealthData: z.boolean().optional(),
    newActivity: z
      .object({
        title: z.string().trim().min(1).max(100),
        measure: z.enum(["minutes", "kilometers", "sessions"]),
      })
      .optional(),
  })
  .superRefine((decision, context) => {
    if (decision.action === "ignore" && decision.shareHealthData) {
      context.addIssue({
        code: "custom",
        path: ["shareHealthData"],
        message: "Ignored workouts cannot be shared",
      });
    }
    if (
      decision.newActivity &&
      (decision.action !== "import_new" || decision.activityId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["newActivity"],
        message: "Choose an existing activity or create one for a new import",
      });
    }
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
    decisions: z.array(workoutReconciliationDecisionSchema).min(1).max(250),
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

export const workoutPrivacyUpdateSchema = z.object({
  healthWorkoutId: boundedId,
  shareHealthData: z.boolean(),
  makeDefault: z.boolean().default(false),
});
