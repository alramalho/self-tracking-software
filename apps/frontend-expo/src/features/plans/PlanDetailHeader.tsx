import { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import LottieView from "lottie-react-native";
import { useIsFocused } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { format } from "date-fns";
import {
  Bot,
  Flame,
  Medal,
  Pause,
  Pencil,
  Sprout,
  UserPlus,
} from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { IconButton, useColors } from "@/components/ui";
import { agentSyncLabel, agentSyncTier } from "./plan-status";
import type { PlanDetailHeaderProps, PlanChipProps } from "./types";

const agentChipColors = {
  fresh: "#0284c7",
  stale: "#d97706",
  dark: "#6b7280",
};

function Chip({ icon: Icon, label, color }: PlanChipProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 20,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: `${color}22`,
      }}
    >
      <Icon size={16} color={color} />
      <Text style={{ fontSize: 13, fontWeight: "500", color }}>{label}</Text>
    </View>
  );
}

function Streak({ streak }: { streak: number }) {
  const c = useColors();
  const focused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const animation = useRef<LottieView>(null);
  const animate = focused && !reducedMotion;
  useEffect(() => {
    if (animate) animation.current?.play();
    else animation.current?.pause();
  }, [animate]);
  return (
    <View
      accessible
      accessibilityLabel={`${streak} week streak`}
      style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
    >
      <Text
        style={{
          fontFamily: "Caveat",
          fontSize: 22,
          color: streak ? c.text : c.muted,
        }}
      >
        x{streak}
      </Text>
      {streak > 0 ? (
        <LottieView
          ref={animation}
          source={require("../../../assets/animations/fire.json")}
          autoPlay={animate}
          loop
          progress={reducedMotion && Platform.OS !== "web" ? 0.5 : undefined}
          style={{ width: 40, height: 40, marginTop: -8 }}
          webStyle={{ width: 40, height: 40, marginTop: -8 }}
        />
      ) : (
        <Flame size={28} color={c.muted} strokeWidth={1.8} />
      )}
    </View>
  );
}

export function PlanDetailHeader({
  plan,
  own,
  onInvite,
  onManage,
}: PlanDetailHeaderProps) {
  const c = useColors();
  const lifestyle = plan.progress?.lifestyleAchievement?.isAchieved;
  const habit = plan.progress?.habitAchievement?.isAchieved;
  const agentManaged = plan.contentPlanner === "EXTERNAL_AGENT";
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <Text style={{ fontSize: 48, lineHeight: 56 }}>{plan.emoji}</Text>
      <View style={{ flex: 1, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 24, fontWeight: "600", color: c.text }}>
              {plan.goal}
            </Text>
            <Text style={{ fontSize: 14, color: c.muted }}>
              {plan.outlineType === "TIMES_PER_WEEK"
                ? `${plan.timesPerWeek} times per week`
                : "Custom plan"}
              {plan.finishingDate &&
                ` · until ${format(new Date(plan.finishingDate), "MMM d, yyyy")}`}
            </Text>
          </View>
          <Streak streak={plan.progress?.achievement?.streak ?? 0} />
        </View>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
          }}
        >
          {plan.isPaused && <Chip icon={Pause} label="Paused" color="#ca8a04" />}
          {agentManaged && (
            <Chip
              icon={Bot}
              label={agentSyncLabel(plan.externalAgentLastSyncAt)}
              color={agentChipColors[agentSyncTier(plan.externalAgentLastSyncAt)]}
            />
          )}
          {(lifestyle || habit) && (
            <Chip
              icon={lifestyle ? Medal : Sprout}
              label={lifestyle ? "Lifestyle" : "Habit"}
              color={lifestyle ? "#f59e0b" : "#84cc16"}
            />
          )}
          {plan.visibility === "PRIVATE" && (
            <Text style={{ fontSize: 13, color: c.muted }}>Private</Text>
          )}
          {own && (
            <View style={{ flexDirection: "row", marginLeft: -6 }}>
              <IconButton label="Invite to Plan" icon={UserPlus} onPress={onInvite} />
              <IconButton
                label="Manage Plan"
                icon={Pencil}
                testID="plan-settings-button"
                onPress={onManage}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
