import { Text, View } from "react-native";
import { Copy, useColors } from "@/components/ui";
import { useActivities, usePlans } from "@/data/queries";
import type {
  PlanProposalDetailsProps,
  Message,
  ProposalOperation,
  ProposalPatch,
} from "./types";

export function ProposalDetails({
  proposal,
  compact,
}: PlanProposalDetailsProps) {
  const c = useColors();
  const plans = usePlans();
  const activities = useActivities();
  const plan = plans.data?.find((p) => p.id === proposal.planId);
  const patch = proposal.patch as ProposalPatch | undefined;
  const operations: ProposalOperation[] = patch
    ? [
        ...(patch.archive ? [{ type: "archive" }] : []),
        ...(patch.plan ? [{ type: "update_plan", ...patch.plan }] : []),
        ...(patch.sessions?.upsert ?? []).map((session) => ({
          ...plan?.sessions?.find((s) => s.id === session.id),
          ...session,
          type: session.id ? "update_session" : "add_session",
        })),
        ...(patch.sessions?.deleteIds ?? []).map((id) => ({
          ...plan?.sessions?.find((s) => s.id === id),
          type: "delete_session",
        })),
        ...(patch.milestones?.upsert ?? []).map((m) => ({
          ...plan?.milestones?.find((item) => item.id === m.id),
          ...m,
          type: m.id ? "update_milestone" : "add_milestone",
        })),
        ...(patch.milestones?.deleteIds ?? []).map((id) => ({
          ...plan?.milestones?.find((item) => item.id === id),
          type: "delete_milestone",
        })),
      ]
    : ((proposal.operations ?? []) as ProposalOperation[]);
  const labels: Record<string, string> = {
    archive: "Archive plan",
    update_plan: "Update plan setup",
    add: "Add session",
    remove: "Remove session",
    add_session: "Add session",
    update_session: "Update session",
    delete_session: "Remove session",
    add_milestone: "Add milestone",
    update_milestone: "Update milestone",
    delete_milestone: "Remove milestone",
  };
  if (compact)
    return (
      <View style={{ gap: 4 }}>
        {operations.slice(0, 3).map((op, index) => {
          const activity = activities.data?.find((a) => a.id === op.activityId);
          return (
            <Text key={index} style={{ fontSize: 12, color: c.text }}>
              {labels[op.type] ?? "Update session"}
              {activity ? ` · ${activity.emoji} ${activity.title}` : ""}
              {op.quantity != null
                ? ` · ${op.quantity} ${activity?.measure ?? ""}`
                : ""}
              {op.date ? ` · ${new Date(op.date).toLocaleDateString()}` : ""}
            </Text>
          );
        })}
        {operations.length > 3 && (
          <Text style={{ color: c.muted, fontSize: 12 }}>
            +{operations.length - 3} more changes
          </Text>
        )}
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      {operations.map((op, index) => {
        const activity = activities.data?.find((a) => a.id === op.activityId);
        return (
          <View key={index} style={{ gap: 4 }}>
            <Copy>{labels[op.type] ?? "Update session"}</Copy>
            {activity && (
              <Copy>
                {activity.emoji} {activity.title}
                {op.quantity !== undefined
                  ? ` · ${op.quantity} ${activity.measure}`
                  : ""}
              </Copy>
            )}
            {op.date && (
              <Copy muted>{new Date(op.date).toLocaleDateString()}</Copy>
            )}
            {op.goal && <Copy>{op.goal}</Copy>}
            {op.goalReason !== undefined && (
              <Copy>{op.goalReason || "Clear goal reason"}</Copy>
            )}
            {op.timesPerWeek !== undefined && (
              <Copy>{op.timesPerWeek} times per week</Copy>
            )}
            {op.finishingDate !== undefined && (
              <Copy>
                {op.finishingDate
                  ? new Date(op.finishingDate).toLocaleDateString()
                  : "No end date"}
              </Copy>
            )}
            {!!op.notes && <Copy>{op.notes}</Copy>}
            {!!op.descriptiveGuide && <Copy>{op.descriptiveGuide}</Copy>}
            {!!op.description && <Copy>{op.description}</Copy>}
            {op.progress !== undefined && <Copy>{op.progress}% complete</Copy>}
            {typeof op.criteria === "string" && (
              <Copy muted>{op.criteria}</Copy>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function hasProposalChanges(
  proposal: NonNullable<Message["planProposals"]>[number],
) {
  const patch = proposal.patch as ProposalPatch | undefined;
  return !!(
    proposal.operations?.length ||
    patch?.archive ||
    patch?.plan ||
    patch?.sessions?.upsert?.length ||
    patch?.sessions?.deleteIds?.length ||
    patch?.milestones?.upsert?.length ||
    patch?.milestones?.deleteIds?.length
  );
}
