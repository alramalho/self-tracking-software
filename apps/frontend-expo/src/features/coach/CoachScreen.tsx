import { useState } from "react";
import { Image, Pressable, Switch, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { formatDistanceToNowStrict } from "date-fns";
import { Text } from "@/components/typography/Text";
import { Panel, Screen, Status, useColors } from "@/components/ui";
import { useCurrentUser, usePlans } from "@/data/queries";
import { useRefresh } from "@/data/useRefresh";
import { coachIdentity } from "@/features/messages/coach";
import { latestCoachChat } from "@/features/messages/service";
import { MetricLogger } from "@/features/metrics/MetricLogger";
import { coachAvatar } from "./avatar";
import { CoachItemDrawer } from "./inbox/CoachItemDrawer";
import { useCoachInbox } from "./inbox/useCoachInbox";
import { useCoachingSwitches } from "./useCoaching";
import type { CoachItem, CoachRowProps, SectionLabelProps } from "./types";

function SectionLabel({ children }: SectionLabelProps) {
  const c = useColors();
  return <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600", paddingHorizontal: 4 }}>{children}</Text>;
}

function CoachRow({ item, onPress }: CoachRowProps) {
  const c = useColors();
  return (
    <Pressable
      testID={`coach-item-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.label}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderColor: c.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ width: 36, textAlign: "center", fontSize: 22 }}>{item.emoji}</Text>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>
          {/* Alerts and today's check-in are states, not messages: no time. */}
          {item.kind === "alert" || item.kind === "checkin"
            ? item.label
            : `${item.label} · ${formatDistanceToNowStrict(new Date(item.at), { addSuffix: true })}`}
        </Text>
      </View>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent }} />
    </Pressable>
  );
}

// Who keeps you on track: the coach, one switch for everything, what the coach is waiting on you
// for, and one switch per plan.
export default function CoachScreen() {
  const c = useColors();
  const user = useCurrentUser();
  const plans = usePlans();
  const inbox = useCoachInbox();
  const coaching = useCoachingSwitches();
  const coach = coachIdentity(user.data?.coachPersonality);
  const [open, setOpen] = useState<CoachItem>();
  const [checkIn, setCheckIn] = useState(false);
  const { refresh, refreshing } = useRefresh(
    "follow-through",
    "plans",
    "activity-entries",
    "coach-attention",
    "metrics",
    "metric-entries",
    "miss-answered",
  );
  const active = (plans.data ?? []).filter(
    (p) => !p.archivedAt && !p.deletedAt && (!p.finishingDate || new Date(p.finishingDate) >= new Date()),
  );
  const openMessages = async () => {
    const chat = await latestCoachChat();
    router.push({ pathname: "/chat/[id]", params: { id: chat.id, type: "COACH" } });
  };
  return (
    <Screen testID="coach-screen" title="Coach" onRefresh={refresh} refreshing={refreshing}>
      <Status loading={inbox.loading} error={inbox.error} retry={refresh} />
      <Panel style={{ padding: 16, borderRadius: 18, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image source={coachAvatar(user.data?.coachPersonality === "STRATEGIST")} style={{ width: 48, height: 48 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{coach.name}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>{coach.title}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderColor: c.border, paddingTop: 14 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>Coaching</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {coaching.canCoach || !coaching.ready
                ? "Check-ins, weekly reviews and messages after you log"
                : "Coaching comes with Plus"}
            </Text>
          </View>
          <Switch
            testID="coach-master-switch"
            accessibilityLabel="Coaching for all plans"
            value={coaching.canCoach && coaching.master}
            disabled={!coaching.ready || !coaching.canCoach || coaching.busy}
            onValueChange={coaching.setMaster}
            trackColor={{ true: c.accent }}
          />
        </View>
      </Panel>

      <SectionLabel>Recent</SectionLabel>
      <Panel style={{ paddingVertical: 4, paddingHorizontal: 16, borderRadius: 18, gap: 0 }}>
        <Pressable
          testID="coach-messages"
          accessibilityRole="button"
          accessibilityLabel={`Messages with ${coach.name}`}
          onPress={() => void openMessages()}
          style={({ pressed }) => ({ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.6 : 1 })}
        >
          <Image source={coachAvatar(user.data?.coachPersonality === "STRATEGIST")} style={{ width: 36, height: 36 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>Messages</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>Your conversation with {coach.name}</Text>
          </View>
          <ChevronRight size={18} color={c.muted} />
        </Pressable>
        {inbox.items.map((item) => (
          <CoachRow key={item.id} item={item} onPress={() => setOpen(item)} />
        ))}
      </Panel>

      {active.length > 0 && <SectionLabel>Your plans</SectionLabel>}
      {!coaching.master && coaching.canCoach && (
        <Text style={{ color: c.muted, fontSize: 13, paddingHorizontal: 4 }}>
          Coaching is off for every plan. Each plan keeps its own setting for when you turn it back on.
        </Text>
      )}
      {active.map((plan) => {
        const on = coaching.planOn(plan.id);
        return (
          <Panel
            key={plan.id}
            testID={`coach-plan-${plan.id}`}
            style={{ padding: 16, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 12, opacity: coaching.master ? 1 : 0.5 }}
          >
            <Text style={{ fontSize: 28 }}>{plan.emoji}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>{plan.goal}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>
                {!coaching.master ? "Off for all plans" : on ? "Coached" : "Just tracking"}
              </Text>
            </View>
            <Switch
              testID={`coach-plan-switch-${plan.id}`}
              accessibilityLabel={`Coaching for ${plan.goal}`}
              value={coaching.master && on}
              disabled={!coaching.canChangePlan}
              onValueChange={(next) => coaching.setPlan(plan, next)}
              trackColor={{ true: c.accent }}
            />
          </Panel>
        );
      })}
      <Status error={coaching.error} />
      <CoachItemDrawer item={open} onClose={() => setOpen(undefined)} onCheckIn={() => setCheckIn(true)} />
      {checkIn && <MetricLogger onClose={() => setCheckIn(false)} />}
      {coaching.consentSheet}
    </Screen>
  );
}
