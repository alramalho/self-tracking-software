import { AchievementGlow } from "./AchievementGlow";
import { PlanProgressStrip } from "./PlanProgressStrip";
import { Reveal } from "@/components/reveal/Reveal";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Medal, Pencil, Settings2, Sprout } from "lucide-react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { router } from "expo-router";
import { Heading, IconButton, useColors, Copy, Panel, s } from "@/components/ui";
import type { Activity, ActivityEntry, Plan } from "@/core/types";
import { dateLabel } from "@/core/dates";
import { Heatmap } from "./Heatmap";
import { PlanWeeks } from "./weeks/PlanWeeks";
import { PlanDrawer } from "./PlanDrawer";
import { EntryEditor } from "../activities/EntryEditor";
import { ActivityEditor } from "../activities/ActivityEditor";
import { CirclePlanSection } from "../circles/CirclePlanSection";
interface Props {
  plan: Plan;
  entries: ActivityEntry[];
  own?: boolean;
  premium?: boolean;
  detail?: boolean;
}
// The plan page (detail) reads top to bottom: header, progress stepper, this week and next,
// history, circle. Elsewhere the card is compact: header and history.
export function PlanCard({
  plan,
  entries,
  own = false,
  premium = false,
  detail = false,
}: Props) {
  const c = useColors();
  const [editing, setEditing] = useState<ActivityEntry>();
  const [editingActivity, setEditingActivity] = useState<Activity>();
  const [settings, setSettings] = useState(false);
  const achievedColor = plan.progress?.lifestyleAchievement?.isAchieved
    ? "#f59e0b"
    : plan.progress?.habitAchievement?.isAchieved
      ? "#84cc16"
      : undefined;
  const cadence = [
    plan.outlineType === "TIMES_PER_WEEK" ? `${plan.timesPerWeek} times per week` : "Custom plan",
    detail && plan.finishingDate ? `until ${dateLabel(plan.finishingDate)}` : null,
    plan.isPaused ? "paused" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Panel
      testID="plan-card"
      style={{
        padding: detail ? 0 : 16,
        gap: detail ? 28 : 14,
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
                <Stop offset="0" stopColor={detail ? c.bg : c.card} stopOpacity={0} />
                <Stop offset="0.6" stopColor={detail ? c.bg : c.card} stopOpacity={0.6} />
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
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontSize: detail ? 24 : 18, fontWeight: "600", color: c.text }}>
            {plan.goal}
          </Text>
          {(achievedColor || plan.visibility === "PRIVATE") && (
            <View style={[s.row, { flexWrap: "wrap", gap: 6 }]}>
              {achievedColor && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 20,
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    backgroundColor: `${achievedColor}22`,
                  }}
                >
                  {plan.progress?.lifestyleAchievement?.isAchieved ? (
                    <Medal size={16} color={achievedColor} />
                  ) : (
                    <Sprout size={16} color={achievedColor} />
                  )}
                  <Text style={{ fontSize: 13, fontWeight: "600", color: achievedColor }}>
                    {plan.progress?.lifestyleAchievement?.isAchieved ? "Lifestyle" : "Habit"}
                  </Text>
                </View>
              )}
              {plan.visibility === "PRIVATE" && <Copy muted>Private</Copy>}
            </View>
          )}
          <Copy muted>{cadence}</Copy>
        </View>
        {own && (
          <IconButton
            label={detail ? "Plan settings" : "Edit Plan"}
            icon={detail ? Settings2 : Pencil}
            testID="plan-settings-button"
            onPress={() => (detail ? setSettings(true) : router.push(`/edit-plan/${plan.id}`))}
          />
        )}
      </Reveal>
      {detail && <PlanProgressStrip plan={plan} />}
      {detail && (
        <Reveal id={`plan-weeks-${plan.id}`} delay={100}>
          <PlanWeeks plan={plan} entries={entries} own={own} />
        </Reveal>
      )}
      <Reveal id={`plan-grid-${plan.id}-${detail}`} delay={150} style={detail ? { gap: 10 } : undefined}>
        {detail && <Heading>History</Heading>}
        <View
          style={detail ? { padding: 8, borderRadius: 16, borderWidth: 1, borderColor: c.border } : undefined}
        >
          <Heatmap
            activities={plan.activities ?? []}
            entries={entries}
            plan={plan}
            premium={premium}
            compact={!detail}
            onEntryPress={own ? setEditing : undefined}
            onActivityPress={own ? setEditingActivity : undefined}
          />
        </View>
      </Reveal>
      {detail &&
        (own ? (
          <CirclePlanSection planId={plan.id} />
        ) : (
          plan.planGroup && (
            <>
              <Heading>Plan group</Heading>
              {plan.planGroup.members
                .filter((m) => !m.leftAt)
                .map((m) => (
                  <Pressable key={m.user.id} onPress={() => router.push(`/profile/${m.user.username}`)}>
                    <Copy>{m.user.name ?? m.user.username}</Copy>
                  </Pressable>
                ))}
            </>
          )
        ))}
      {editing && <EntryEditor entry={editing} onClose={() => setEditing(undefined)} />}
      {editingActivity && (
        <ActivityEditor activity={editingActivity} onClose={() => setEditingActivity(undefined)} />
      )}
      {own && detail && <PlanDrawer plan={plan} visible={settings} onClose={() => setSettings(false)} />}
    </Panel>
  );
}
