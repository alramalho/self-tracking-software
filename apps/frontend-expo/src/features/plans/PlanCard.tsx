import { SupportEditor } from "../follow-through/SupportEditor";
import { AchievementGlow } from "./AchievementGlow";
import { CoachOverview } from "./CoachOverview";
import { PlanProgressStrip } from "./PlanProgressStrip";
import { Reveal } from "@/components/reveal/Reveal";
import { useState } from "react";
import { Image, Pressable, View, Switch } from "react-native";
import { Text } from "@/components/typography/Text";
import {
  Archive,
  ArchiveRestore,
  Medal,
  Pause,
  Pencil,
  Play,
  PlusSquare,
  Sprout,
  Trash2,
} from "lucide-react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { router } from "expo-router";
import {
  Heading,
  IconButton,
  useColors,
  Copy,
  Panel,
  Button,
  Sheet,
  Field,
  Status,
  s,
} from "@/components/ui";
import { useAction } from "@/data/queries";
import { api } from "@/data/api";
import type { Activity, ActivityEntry, Plan, PlanSession } from "@/core/types";
import { Heatmap } from "./Heatmap";
import { PlanNotes } from "./PlanNotes";
import { MilestoneOverview } from "./MilestoneOverview";
import { CurrentWeek } from "./WeekProgress";
import { WeekCalendar } from "./WeekCalendar";
import { EntryEditor } from "../activities/EntryEditor";
import { ActivityEditor } from "../activities/ActivityEditor";
import { SettingsCard } from "../settings/SettingsCard";
interface Props {
  plan: Plan;
  entries: ActivityEntry[];
  own?: boolean;
  premium?: boolean;
  detail?: boolean;
}
type ManageView = "actions" | "pause" | "delete";
export function PlanCard({
  plan,
  entries,
  own = false,
  premium = false,
  detail = false,
}: Props) {
  const c = useColors();
  const [sessionDetail, setSessionDetail] = useState<PlanSession>();
  const [editing, setEditing] = useState<ActivityEntry>();
  const [editingActivity, setEditingActivity] = useState<Activity>();
  const [settings, setSettings] = useState(false);
  const [manageView, setManageView] = useState<ManageView>("actions");
  const [reason, setReason] = useState("");
  const [showFuture, setShowFuture] = useState(false);
  const scheduledEntries: ActivityEntry[] = (plan.sessions ?? []).map(
    (session) => ({
      id: session.id,
      activityId: session.activityId,
      datetime: session.date,
      quantity: session.quantity ?? 1,
      createdAt: plan.createdAt,
      userId: plan.userId ?? "",
    }),
  );
  const achievedColor = plan.progress?.lifestyleAchievement?.isAchieved
    ? "#f59e0b"
    : plan.progress?.habitAchievement?.isAchieved
      ? "#84cc16"
      : undefined;
  const action = useAction(async (operation: string) => {
    if (operation === "delete") return api.delete(`/plans/${plan.id}`);
    return api.post(
      `/plans/${plan.id}/${operation}`,
      operation === "pause" ? { reason } : {},
    );
  });
  const closeSettings = () => {
    setSettings(false);
    setManageView("actions");
    setReason("");
  };
  const showSettings = () => {
    setManageView("actions");
    setReason("");
    setSettings(true);
  };
  return (
    <Panel
      testID="plan-card"
      style={{
        padding: detail ? 0 : 16,
        gap: detail ? 24 : 14,
        borderWidth: detail ? 0 : 1,
        borderRadius: detail ? 0 : 16,
        backgroundColor: detail ? "transparent" : c.card,
        overflow: "hidden",
        borderColor: !detail && achievedColor ? `${achievedColor}55` : c.border,
      }}
    >
      {!detail && achievedColor && <AchievementGlow color={achievedColor} />}
      {plan.backgroundImageUrl && (
        <View
          style={{
            height: detail ? 192 : 128,
            borderRadius: detail ? 16 : 0,
            overflow: "hidden",
            marginHorizontal: detail ? 0 : -16,
            marginTop: detail ? 0 : -16,
            marginBottom: detail ? 0 : -32,
          }}
        >
          <Image
            source={{ uri: plan.backgroundImageUrl }}
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={detail ? c.bg : c.card}
                  stopOpacity={0}
                />
                <Stop
                  offset="0.6"
                  stopColor={detail ? c.bg : c.card}
                  stopOpacity={0.6}
                />
                <Stop offset="1" stopColor={detail ? c.bg : c.card} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#fade)" />
          </Svg>
        </View>
      )}
      <Reveal
        id={`plan-header-${plan.id}-${detail}`}
        style={[
          s.row,
          {
            alignItems: "flex-start",
            marginTop: detail || plan.backgroundImageUrl ? 0 : 12,
          },
        ]}
      >
        <Text style={{ fontSize: 48 }}>{plan.emoji}</Text>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={[s.row, { flexWrap: "wrap", gap: 4 }]}>
            <Text
              style={{
                fontSize: detail ? 24 : 18,
                fontWeight: "600",
                color: c.text,
                flexShrink: 1,
              }}
            >
              {plan.goal}
            </Text>
            {own && (
              <IconButton
                label={detail ? "Manage Plan" : "Edit Plan"}
                icon={Pencil}
                testID="plan-settings-button"
                onPress={() =>
                  detail
                    ? showSettings()
                    : router.push(`/edit-plan/${plan.id}`)
                }
              />
            )}
            {achievedColor && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  borderRadius: 20,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  backgroundColor: `${achievedColor}22`,
                }}
              >
                {plan.progress?.lifestyleAchievement?.isAchieved ? (
                  <Medal size={18} color={achievedColor} />
                ) : (
                  <Sprout size={18} color={achievedColor} />
                )}
                <Text style={{ fontSize: 14, color: achievedColor }}>
                  {plan.progress?.lifestyleAchievement?.isAchieved
                    ? "Lifestyle"
                    : "Habit"}
                </Text>
              </View>
            )}
            {plan.visibility === "PRIVATE" && <Copy muted>Private</Copy>}
          </View>
          <Copy muted>
            {plan.outlineType === "TIMES_PER_WEEK"
              ? `${plan.timesPerWeek} times per week`
              : "Custom plan"}
          </Copy>
        </View>
      </Reveal>
      {plan.isPaused && (
        <Copy>
          Ⅱ Plan is paused{plan.pauseReason ? ` · ${plan.pauseReason}` : ""}.
          Streaks still count down.
        </Copy>
      )}
      {detail && (
        <>
          <PlanProgressStrip plan={plan} />
          {!!plan.milestones?.length && (
            <Reveal id={`plan-milestones-${plan.id}`} delay={100}>
              <MilestoneOverview
                milestones={plan.milestones}
                own={own}
                onEdit={() => router.push(`/edit-plan/${plan.id}`)}
              />
            </Reveal>
          )}
        </>
      )}
      <Reveal
        id={`plan-grid-${plan.id}-${detail}`}
        delay={150}
        style={
          detail
            ? {
                padding: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border,
                gap: 16,
              }
            : undefined
        }
      >
        {detail && plan.outlineType === "SPECIFIC" && (
          <View style={[s.row, { justifyContent: "flex-end" }]}>
            <Copy muted>Completed</Copy>
            <Switch
              testID="display-future-activities-switch"
              accessibilityLabel="Show planned activities"
              value={showFuture}
              onValueChange={setShowFuture}
              trackColor={{ true: c.accent }}
            />
            <Copy muted>Planned</Copy>
          </View>
        )}
        <Heatmap
          activities={plan.activities ?? []}
          entries={showFuture ? scheduledEntries : entries}
          plan={plan}
          premium={premium}
          compact={!detail}
          onEntryPress={
            showFuture
              ? (entry) =>
                  setSessionDetail(
                    plan.sessions.find((session) => session.id === entry.id),
                  )
              : own
                ? setEditing
                : undefined
          }
          onActivityPress={own ? setEditingActivity : undefined}
        />
      </Reveal>
      {detail && (
        <>
          <Reveal id={`plan-week-${plan.id}`} delay={200}>
            {plan.outlineType === "TIMES_PER_WEEK" ? (
              <CurrentWeek plan={plan} entries={entries} own={own} />
            ) : (
              <Panel style={{ padding: 16, borderRadius: 16 }}>
                <Heading>Coming up</Heading>
                <WeekCalendar
                  plans={[plan]}
                  entries={entries}
                  onLog={
                    own
                      ? (activityId, date) =>
                          router.push({
                            pathname: "/(tabs)/add",
                            params: { activityId, date: date.toISOString() },
                          })
                      : undefined
                  }
                />
              </Panel>
            )}
          </Reveal>
          {own && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log Activity from plan"
              onPress={() => router.push("/(tabs)/add")}
              style={{
                height: 100,
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: c.border,
                borderRadius: 12,
                backgroundColor: c.soft,
                gap: 8,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlusSquare size={32} color={c.muted} />
              <Copy muted>Log Activity</Copy>
            </Pressable>
          )}
          <Reveal id={`plan-notes-${plan.id}`}>
            <PlanNotes plan={plan} own={own} />
          </Reveal>
          {own && (
            <>
              <SupportEditor plan={plan} />
              <CoachOverview plans={[plan]} entries={entries} />
            </>
          )}
          {plan.planGroup && (
            <>
              <Heading>Plan group</Heading>
              {plan.planGroup.members
                .filter((m) => !m.leftAt)
                .map((m) => (
                  <Pressable
                    key={m.user.id}
                    onPress={() => router.push(`/profile/${m.user.username}`)}
                  >
                    <Copy>{m.user.name ?? m.user.username}</Copy>
                  </Pressable>
                ))}
            </>
          )}
          <Status error={action.error} />
        </>
      )}
      {sessionDetail && (
        <Sheet
          visible
          title="Planned activity"
          onClose={() => setSessionDetail(undefined)}
        >
          <Copy>
            {
              plan.activities.find(
                (activity) => activity.id === sessionDetail.activityId,
              )?.title
            }{" "}
            · {sessionDetail.quantity}
          </Copy>
          {!!sessionDetail.descriptiveGuide && (
            <Copy>{sessionDetail.descriptiveGuide}</Copy>
          )}
          {sessionDetail.imageUrls?.map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={{ width: "100%", height: 240, borderRadius: 12 }}
              resizeMode="contain"
            />
          ))}
        </Sheet>
      )}
      {editing && (
        <EntryEditor entry={editing} onClose={() => setEditing(undefined)} />
      )}
      {editingActivity && (
        <ActivityEditor
          activity={editingActivity}
          onClose={() => setEditingActivity(undefined)}
        />
      )}
      <Sheet
        visible={settings}
        title={
          manageView === "pause"
            ? "Pause Plan"
            : manageView === "delete"
              ? "Delete Plan"
              : "Manage Plan"
        }
        onClose={closeSettings}
      >
        {manageView === "actions" ? (
          <View style={{ gap: 10 }}>
            <SettingsCard
              icon={Pencil}
              title="Edit Plan"
              description="Change this plan's goal, schedule, or appearance"
              onPress={() => {
                closeSettings();
                router.push(`/edit-plan/${plan.id}`);
              }}
            />
            <SettingsCard
              icon={plan.isPaused ? Play : Pause}
              title={plan.isPaused ? "Resume Plan" : "Pause Plan"}
              description={
                plan.isPaused
                  ? "Continue tracking this plan"
                  : "Streaks continue to count down while paused"
              }
              color={plan.isPaused ? c.accent : "#d97706"}
              onPress={() => {
                if (plan.isPaused) {
                  action.mutate("resume", { onSuccess: closeSettings });
                } else {
                  setReason("");
                  setManageView("pause");
                }
              }}
              disabled={action.isPending}
            />
            <SettingsCard
              icon={plan.archivedAt ? ArchiveRestore : Archive}
              title={plan.archivedAt ? "Restore Plan" : "Archive Plan"}
              description={
                plan.archivedAt
                  ? "Return this plan to your active plans"
                  : "Hide this plan from your active plans"
              }
              onPress={() =>
                action.mutate(plan.archivedAt ? "unarchive" : "archive", {
                  onSuccess: closeSettings,
                })
              }
              disabled={action.isPending}
            />
            <SettingsCard
              icon={Trash2}
              title="Delete Plan"
              description="Permanently delete this plan; activity logs remain"
              color="#dc2626"
              onPress={() => {
                setManageView("delete");
              }}
            />
          </View>
        ) : manageView === "pause" ? (
          <View style={{ gap: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                padding: 12,
                borderRadius: 12,
                backgroundColor: "#f59e0b18",
              }}
            >
              <Pause size={20} color="#d97706" />
              <Copy>
                Streaks will continue to count down while your plan is paused.
              </Copy>
            </View>
            <Field
              label="Reason for pausing (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Taking a short break"
            />
            <Button
              busy={action.isPending}
              onPress={() =>
                action.mutate("pause", { onSuccess: closeSettings })
              }
            >
              Pause Plan
            </Button>
            <Button
              secondary
              disabled={action.isPending}
              onPress={() => setManageView("actions")}
            >
              Cancel
            </Button>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <Copy>Delete this plan? Your activity logs will remain.</Copy>
            <Copy muted>This action cannot be undone.</Copy>
            <Button
              danger
              busy={action.isPending}
              onPress={() =>
                action.mutate("delete", { onSuccess: closeSettings })
              }
            >
              Confirm Delete
            </Button>
            <Button
              secondary
              disabled={action.isPending}
              onPress={() => {
                setManageView("actions");
              }}
            >
              Cancel
            </Button>
          </View>
        )}
        <Status error={action.error} />
      </Sheet>
    </Panel>
  );
}
