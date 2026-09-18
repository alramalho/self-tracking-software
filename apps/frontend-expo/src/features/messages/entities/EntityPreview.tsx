import { metricInterpretation } from "./metricInterpretation";
import { coachIdentity } from "../coach";
import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle,
  Info,
} from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useActivities,
  useCurrentUser,
  useEntries,
  usePlans,
} from "@/data/queries";
import { api } from "@/data/api";
import { Copy, Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import type { PlanSession } from "@/core/types";
import { PreviewButton, PreviewSheet, PreviewTouch } from "./PreviewSheet";
import type { PreviewProps } from "./types";

export function EntityPreview({ reference, message, onClose }: PreviewProps) {
  const c = useColors();
  const user = useCurrentUser();
  const plans = usePlans();
  const activities = useActivities();
  const entries = useEntries();
  const client = useQueryClient();
  const [session, setSession] = useState<PlanSession>();
  const plan = plans.data?.find((item) => item.id === reference?.id);
  const activity = activities.data?.find((item) => item.id === reference?.id);
  const linked =
    plans.data?.filter((item) =>
      item.activities?.some((a) => a.id === reference?.id),
    ) ?? [];
  const today = startOfDay(new Date());
  const upcoming = (plan?.sessions ?? [])
    .filter(
      (item) =>
        new Date(item.date) >= today &&
        new Date(item.date) <= addDays(today, 7),
    )
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .slice(0, 4);
  const metric = message?.metricReplacement;
  const action = useMutation({
    mutationFn: (accept: boolean) =>
      api.post(
        `/ai/messages/${message!.id}/${accept ? "accept" : "reject"}-metric`,
        accept ? { date: null } : undefined,
      ),
    onSuccess: async () => {
      await client.invalidateQueries();
      onClose();
    },
  });
  const close = () => {
    setSession(undefined);
    onClose();
  };
  const navigate = (id: string) => {
    close();
    router.push(`/plan/${id}`);
  };
  const title = session
    ? "Session details"
    : reference?.kind === "plan"
      ? "Plan Preview"
      : reference?.kind === "activity"
        ? "Activity"
        : "Metric Suggestion";
  const sessionActivity = activities.data?.find(
    (a) => a.id === session?.activityId,
  );
  return (
    <PreviewSheet visible={!!reference} title={title} onClose={close}>
      {session ? (
        <>
          <PreviewTouch
            accessibilityRole="button"
            accessibilityLabel="Back to plan preview"
            onPress={() => setSession(undefined)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <ArrowLeft color={c.text} size={20} />
            <Copy>Plan Preview</Copy>
          </PreviewTouch>
          <Text style={{ fontSize: 30 }}>{sessionActivity?.emoji}</Text>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
            {sessionActivity?.title}
          </Text>
          <Copy muted>
            {format(new Date(session.date), "EEEE, MMMM d")}
            {session.quantity != null
              ? ` · ${session.quantity} ${sessionActivity?.measure ?? ""}`
              : ""}
          </Copy>
          <View
            style={{ backgroundColor: c.soft, padding: 12, borderRadius: 12 }}
          >
            <Copy>{session.descriptiveGuide}</Copy>
          </View>
        </>
      ) : reference?.kind === "plan" && plan ? (
        <>
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
              paddingRight: 32,
            }}
          >
            <Text style={{ fontSize: 30 }}>{plan.emoji || "🎯"}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
                {plan.goal}
              </Text>
              <Copy muted>
                {plan.activities.length}{" "}
                {plan.activities.length === 1 ? "activity" : "activities"}
              </Copy>
            </View>
          </View>
          {!!plan.activities.length && (
            <>
              <Copy muted>Activities</Copy>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {plan.activities.slice(0, 6).map((a) => {
                  const total = upcoming
                    .filter((s) => s.activityId === a.id)
                    .reduce((sum, s) => sum + (s.quantity ?? 0), 0);
                  return (
                    <View
                      key={a.id}
                      style={{
                        flexDirection: "row",
                        gap: 6,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: c.soft,
                      }}
                    >
                      <Text style={{ color: c.text, fontSize: 14 }}>
                        {a.emoji} {a.title}
                        {total > 0 ? ` · ${total} ${a.measure}` : ""}
                      </Text>
                    </View>
                  );
                })}
                {plan.activities.length > 6 && (
                  <Copy muted>+{plan.activities.length - 6} more</Copy>
                )}
              </View>
            </>
          )}
          {!!upcoming.length && (
            <>
              <View
                style={{ flexDirection: "row", gap: 6, alignItems: "center" }}
              >
                <CalendarDays size={14} color={c.muted} />
                <Copy muted>Upcoming this week</Copy>
              </View>
              <View style={{ gap: 8 }}>
                {upcoming.map((s) => {
                  const a = activities.data?.find(
                    (item) => item.id === s.activityId,
                  );
                  const completed = entries.data?.some(
                    (e) =>
                      e.activityId === s.activityId &&
                      isSameDay(new Date(e.datetime), new Date(s.date)),
                  );
                  return (
                    <PreviewTouch
                      key={s.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Session: ${a?.title ?? "Activity"}, ${format(new Date(s.date), "EEE")}`}
                      disabled={!s.descriptiveGuide}
                      onPress={() => setSession(s)}
                      style={{
                        backgroundColor: completed ? "#22c55e1a" : c.soft,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {completed ? (
                        <CheckCircle color="#22c55e" size={14} />
                      ) : (
                        <Text>{a?.emoji}</Text>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.text, fontSize: 14 }}>
                          {a?.title ?? "Activity"}
                        </Text>
                        {s.quantity != null && (
                          <Text style={{ color: c.muted, fontSize: 12 }}>
                            {s.quantity} {a?.measure}
                          </Text>
                        )}
                      </View>
                      {!!s.descriptiveGuide && (
                        <Info size={13} color={c.muted} />
                      )}
                      <Text style={{ color: c.muted, fontSize: 12 }}>
                        {isSameDay(new Date(s.date), today)
                          ? "Today"
                          : format(new Date(s.date), "EEE")}
                      </Text>
                    </PreviewTouch>
                  );
                })}
              </View>
            </>
          )}
          <PreviewButton
            label="View full plan"
            onPress={() => navigate(plan.id)}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>
                View full plan
              </Text>
              <ArrowRight size={16} color="white" />
            </View>
          </PreviewButton>
        </>
      ) : reference?.kind === "activity" && activity ? (
        <>
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
              paddingRight: 32,
            }}
          >
            <Text style={{ fontSize: 30 }}>{activity.emoji}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
                {activity.title}
              </Text>
              <Copy muted>{activity.measure}</Copy>
            </View>
          </View>
          {!!linked.length && (
            <>
              <Copy muted>Part of</Copy>
              {linked.slice(0, 3).map((p) => (
                <PreviewTouch
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={p.goal}
                  onPress={() => navigate(p.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: c.soft,
                    borderRadius: 8,
                  }}
                >
                  <Text>{p.emoji}</Text>
                  <Text style={{ color: c.text, flex: 1, fontSize: 14 }}>
                    {p.goal}
                  </Text>
                  <ArrowRight size={14} color={c.muted} />
                </PreviewTouch>
              ))}
              <PreviewButton
                label="View plan"
                onPress={() => navigate(linked[0].id)}
              />
            </>
          )}
        </>
      ) : reference?.kind === "metric" && metric ? (
        <>
          <Text style={{ fontSize: 48, textAlign: "center" }}>
            {metric.metric.emoji}
          </Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "600",
              color: c.text,
              textAlign: "center",
            }}
          >
            Log {metric.rating}/5 for {metric.metric.title}?
          </Text>
          <Text
            style={{
              color: c.muted,
              fontSize: 14,
              fontStyle: "italic",
              textAlign: "center",
            }}
          >
            {metricInterpretation(
              metric.metric.title,
              metric.rating,
              coachIdentity(user.data?.coachPersonality).name,
            )}
          </Text>
          <Status error={action.error} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PreviewButton
                secondary
                label="Reject"
                disabled={action.isPending}
                onPress={() => action.mutate(false)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PreviewButton
                label={action.isPending ? "Logging..." : "Accept"}
                disabled={action.isPending}
                onPress={() => action.mutate(true)}
              />
            </View>
          </View>
        </>
      ) : (
        <Copy muted>This item is no longer available.</Copy>
      )}
    </PreviewSheet>
  );
}
