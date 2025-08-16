import {
  ANYONE_CAN_DO_ANYTHING,
  definePermissions,
  PermissionsConfig,
  Schema,
} from "@rocicorp/zero";
import { schema } from "./schema";

export const permissions = definePermissions<string, Schema>(schema, () => {
  return {
    users: ANYONE_CAN_DO_ANYTHING,
    connections: ANYONE_CAN_DO_ANYTHING,
    activities: ANYONE_CAN_DO_ANYTHING,
    activity_entries: ANYONE_CAN_DO_ANYTHING,
    reactions: ANYONE_CAN_DO_ANYTHING,
    comments: ANYONE_CAN_DO_ANYTHING,
    metrics: ANYONE_CAN_DO_ANYTHING,
    metric_entries: ANYONE_CAN_DO_ANYTHING,
    plans: ANYONE_CAN_DO_ANYTHING,
    plan_sessions: ANYONE_CAN_DO_ANYTHING,
    plan_milestones: ANYONE_CAN_DO_ANYTHING,
    plan_groups: ANYONE_CAN_DO_ANYTHING,
    plan_invitations: ANYONE_CAN_DO_ANYTHING,
    messages: ANYONE_CAN_DO_ANYTHING,
    message_emotions: ANYONE_CAN_DO_ANYTHING,
    notifications: ANYONE_CAN_DO_ANYTHING,
    recommendations: ANYONE_CAN_DO_ANYTHING,
    _ActivityToPlan: ANYONE_CAN_DO_ANYTHING,
    _PlanGroupToUser: ANYONE_CAN_DO_ANYTHING,
  } satisfies PermissionsConfig<string, Schema>;
});
