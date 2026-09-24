import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { format, parseISO } from "date-fns";
import { Copy, useColors } from "@/components/ui";
import { useActivities, usePlans } from "@/data/queries";
import type {
  PlanProposalDetailsProps,
  Message,
  ProposalOperation,
  ProposalPatch,
  SessionCardProps,
} from "./types";

const onDay = (date: string | Date) =>
  typeof date === "string" ? parseISO(date.slice(0, 10)) : date;
const shortUnits: Record<string, string> = {
  kilometers: "km",
  kilometres: "km",
  meters: "m",
  metres: "m",
  minutes: "min",
  seconds: "s",
  miles: "mi",
};
/** "3 kilometers" → "3 km"; unknown units stay as they are. */
const amount = (quantity: number, measure = "") =>
  `${quantity} ${shortUnits[measure.toLowerCase()] ?? measure}`.trim();

/** One proposed session, in the style of the plan calendar: date, amount, then the how-to. */
function SessionCard({ op, activity, removed }: SessionCardProps) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const day = op.date ? onDay(op.date) : undefined;
  const guide = op.descriptiveGuide?.trim();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${activity?.title ?? "Session"}${day ? ` on ${format(day, "EEEE, MMM d")}` : ""}`}
      disabled={!guide}
      onPress={() => setOpen((value) => !value)}
      style={{
        flexDirection: "row",
        gap: 14,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        opacity: removed ? 0.55 : 1,
      }}
    >
      <View style={{ width: 40, alignItems: "center" }}>
        <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700" }}>
          {day ? format(day, "EEE").toUpperCase() : "—"}
        </Text>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: "700" }}>
          {day ? format(day, "d") : ""}
        </Text>
        <Text style={{ color: c.muted, fontSize: 10, fontWeight: "600" }}>
          {day ? format(day, "MMM").toUpperCase() : ""}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            color: c.text,
            fontSize: 16,
            fontWeight: "600",
            textDecorationLine: removed ? "line-through" : "none",
          }}
        >
          {activity?.emoji ?? "📋"}{" "}
          {op.quantity != null
            ? amount(op.quantity, activity?.measure)
            : (activity?.title ?? "Session")}
          {op.type === "update_session" ? "  · changed" : ""}
          {removed ? "  · removed" : ""}
        </Text>
        {!!guide && (
          <Text
            numberOfLines={open ? undefined : 2}
            style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}
          >
            {guide}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** Switching to dated sessions is how a first week is stored, not a choice to review. */
const isOutlineOnly = (plan: Partial<ProposalOperation>) =>
  Object.keys(plan).every((key) => key === "outlineType");
const sessionTypes = ["add_session", "update_session", "delete_session"];

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
        ...(patch.plan && !isOutlineOnly(patch.plan)
          ? [{ type: "update_plan", ...patch.plan }]
          : []),
        ...(patch.track ?? []).map((t) => ({
          type: "track",
          description: `${t.emoji} ${t.title} · ${t.measure}`,
        })),
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
    track: "Start tracking",
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
              {sessionTypes.includes(op.type)
                ? `${activity?.emoji ?? "📋"} ${op.quantity != null ? amount(op.quantity, activity?.measure) : (activity?.title ?? "Session")}${op.date ? ` · ${format(onDay(op.date), "EEE d MMM")}` : ""}${op.type === "delete_session" ? " · removed" : op.type === "update_session" ? " · changed" : ""}`
                : `${labels[op.type] ?? "Update"}${op.description ? ` · ${op.description}` : ""}`}
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
  const sessions = operations
    .filter((op) => sessionTypes.includes(op.type))
    .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
  const others = operations.filter((op) => !sessionTypes.includes(op.type));
  return (
    <View style={{ gap: 12 }}>
      {sessions.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
            {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
            {sessions.some((op) => op.descriptiveGuide) ? " · tap for details" : ""}
          </Text>
          {sessions.map((op, index) => (
            <SessionCard
              key={op.id ?? index}
              op={op}
              activity={activities.data?.find((a) => a.id === op.activityId)}
              removed={op.type === "delete_session"}
            />
          ))}
        </View>
      )}
      {others.map((op, index) => {
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
    patch?.track?.length ||
    patch?.sessions?.upsert?.length ||
    patch?.sessions?.deleteIds?.length ||
    patch?.milestones?.upsert?.length ||
    patch?.milestones?.deleteIds?.length
  );
}
