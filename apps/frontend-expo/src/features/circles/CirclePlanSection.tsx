import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, Flame, Users } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Heading, Panel, s, useColors } from "@/components/ui";
import { useCurrentUser } from "@/data/queries";
import { MotivateDrawer } from "./MotivateDrawer";
import { MemberRow } from "./components";
import { MATCHING_TARGET } from "./model";
import { defaultPreferences, useCircle, useMyCircles } from "./api";
import { setPendingMatch } from "./pendingMatch";
import type { BoardMember, CirclePlanSectionProps } from "./types";

// Your plan's circle at a glance, or the way to find one. One circle per plan.
export function CirclePlanSection({ planId }: CirclePlanSectionProps) {
  const c = useColors();
  const user = useCurrentUser();
  const mine = useMyCircles();
  const circle = mine.data?.find((each) => each.planId === planId);
  const board = useCircle(circle?.id);
  const [motivating, setMotivating] = useState<BoardMember>();
  if (!mine.data) return null;
  if (!circle)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Find a circle for this plan"
        onPress={() => {
          setPendingMatch({ planId, mode: "find", ...defaultPreferences });
          router.push(`/circle-match?planId=${planId}`);
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          minHeight: 56,
          paddingHorizontal: 16,
          borderRadius: 20,
          backgroundColor: c.card,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Users size={22} color={c.text} strokeWidth={1.8} />
        <Text style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: "600" }}>
          Find a circle for this plan
        </Text>
        <ChevronRight size={18} color={c.muted} />
      </Pressable>
    );
  const open = () => router.push(`/circle/${circle.id}`);
  const data = board.data;
  const openSpots = Math.max(0, MATCHING_TARGET - (data?.members.length ?? circle.memberCount));
  const days = circle.daysLeft === 1 ? "1 day left" : `${circle.daysLeft} days left`;
  const status = circle.pending
    ? "Post a photo to join"
    : circle.status === "FORMING"
      ? "Forming · the board starts at 2"
      : `This week · ${days}`;
  return (
    <View style={{ gap: 10 }}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Heading>Circle</Heading>
        <Pressable accessibilityRole="link" accessibilityLabel={`Open ${circle.name}`} hitSlop={8} onPress={open}>
          <Text style={{ color: c.accent, fontSize: 15, fontWeight: "600" }}>Open ›</Text>
        </Pressable>
      </View>
      {/* The circle's week at a glance, like its board: dots, what's left, and encouragement. */}
      <Panel style={{ padding: 16, borderRadius: 16, gap: 2 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${circle.name}, ${status}`} onPress={open} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 6 }}>
          <Text style={{ fontSize: 22 }}>{circle.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{circle.name}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>{status}</Text>
          </View>
          {!!data?.togetherStreak && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Flame size={18} color="#ff9500" />
              <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>{data.togetherStreak}</Text>
            </View>
          )}
        </Pressable>
        {data?.members.map((m) => {
          const isMe = m.user.id === user.data?.id;
          return (
            <MemberRow
              key={m.user.id}
              member={data.status === "FORMING" ? { ...m, week: { ...m.week, isNew: true } } : m}
              isMe={isMe}
              onMotivate={!isMe && m.week.behind ? () => setMotivating(m) : undefined}
            />
          );
        })}
        {openSpots > 0 && (
          <Text style={{ color: c.muted, fontSize: 13, paddingTop: 6 }}>
            {`${openSpots} open ${openSpots === 1 ? "spot" : "spots"} · looking for people with a similar goal`}
          </Text>
        )}
      </Panel>
      {motivating && <MotivateDrawer circleId={circle.id} member={motivating} onClose={() => setMotivating(undefined)} />}
    </View>
  );
}
