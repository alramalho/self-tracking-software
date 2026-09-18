import { AchievementBadge } from "./AchievementBadge";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import Svg, { Circle } from "react-native-svg";
import {
  ChevronLeft,
  Crown,
  EllipsisVertical,
  Gem,
  Medal,
  Star,
  Target,
} from "lucide-react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import {
  Button,
  Copy,
  IconButton,
  Sheet,
  Status,
  useColors,
  s,
} from "@/components/ui";
import { goBack } from "@/core/navigation";
import { useAction } from "@/data/queries";
import { api } from "@/data/api";
import { friendsOf, profileStats } from "./model";
import type { ProfileDetail, ProfileHeaderProps } from "./types";
import { useRankings } from "./rankings";
import { ProgressSheet } from "./ProgressSheet";

function activityCount(person: { _count?: { activityEntries?: number } }) {
  return person._count?.activityEntries ?? 0;
}

export function ProfileHeader({ user, own, current }: ProfileHeaderProps) {
  const c = useColors();
  const stats = profileStats(user);
  const rankings = useRankings();
  const pointsRank = rankings.data?.pointsRanking.find(
    (person) => person.username === user.username,
  )?.rank;
  const streaksRank = rankings.data?.streaksRanking.find(
    (person) => person.username === user.username,
  )?.rank;
  const friends = friendsOf(user);
  const [detail, setDetail] = useState<ProfileDetail>();
  const color = c.dark ? stats.level.dark : stats.level.light;
  // PWA level icons use their Tailwind icon color, independently of the label/ring.
  const iconColors: Record<string, [string, string]> = {
    New: ["#99a1af", "#6a7282"],
    Bronze: ["#e17100", "#fe9a00"],
    Silver: ["#90a1b9", "#cad5e2"],
    Gold: ["#efb100", "#fdc700"],
    Platinum: ["#cad5e2", "#90a1b9"],
    Diamond: ["#00d3f2", "#53eafd"],
  };
  const levelIconColor =
    iconColors[stats.level.name]?.[c.dark ? 1 : 0] ?? color;
  const LevelIcon =
    {
      New: Target,
      Bronze: Medal,
      Silver: Medal,
      Gold: Crown,
      Platinum: Star,
      Diamond: Gem,
    }[stats.level.name] ?? Target;
  const connection = useAction((operation: string) =>
    api.post(`/users/${operation}-connection-request/${user.id}`),
  );
  const chat = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ chat: { id: string } }>("/chats/direct", {
          userId: user.id,
        })
      ).data.chat,
    onSuccess: (result) => router.push(`/chat/${result.id}`),
  });
  const received = current?.connectionsTo?.some(
    (r) => r.fromId === user.id && r.status === "PENDING",
  );
  const sent = current?.connectionsFrom?.some(
    (r) => r.toId === user.id && r.status === "PENDING",
  );
  const friend = !!current && friendsOf(current).some((p) => p.id === user.id);
  const progressLength = 2 * Math.PI * 46 * 0.95;
  return (
    <View testID="profile-header" style={{ gap: 12, paddingTop: 28 }}>
      <View
        style={[
          s.row,
          {
            position: "absolute",
            top: -8,
            left: -8,
            right: -8,
            zIndex: 1,
            justifyContent: own ? "flex-end" : "space-between",
          },
        ]}
      >
        {own && (
          <Pressable
            testID="profile-settings"
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push("/settings")}
            style={{
              width: 50,
              height: 44,
              paddingLeft: 8,
              paddingRight: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <EllipsisVertical size={26} color={c.text} strokeWidth={2} />
          </Pressable>
        )}
      </View>
      <View style={[s.row, { gap: 24 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account progress"
          onPress={() => setDetail("points")}
          style={{
            width: 96,
            height: 96,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg
            width={96}
            height={96}
            style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
          >
            <Circle
              cx={48}
              cy={48}
              r={46}
              stroke={color}
              strokeWidth={4}
              fill="none"
              strokeDasharray={`${progressLength} ${2 * Math.PI * 46}`}
              strokeDashoffset={progressLength * (1 - stats.percentage / 100)}
              strokeLinecap="round"
            />
          </Svg>
          {user.picture ? (
            <Image
              source={{ uri: user.picture }}
              style={{ width: 80, height: 80, borderRadius: 40 }}
            />
          ) : (
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: c.soft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 20, color: c.text }}>
                {user.name?.[0] ?? "U"}
              </Text>
            </View>
          )}
        </Pressable>
        <View testID="profile-stats" style={[s.row, { flex: 1, gap: 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${friends.length} Friends`}
            onPress={() => setDetail("friends")}
            style={{
              flex: 1,
              minWidth: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: c.text }}>
              {friends.length}
            </Text>
            <Text style={{ fontSize: 12, color: c.muted }}>Friends</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${stats.points} Points`}
            onPress={() => setDetail("points")}
            style={{
              flex: 1,
              minWidth: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: c.text }}>
              {stats.points}
            </Text>
            <Text style={{ fontSize: 12, color: c.muted }}>Points</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${stats.level.name} level`}
            onPress={() => setDetail("points")}
            style={{
              flex: 1,
              minWidth: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LevelIcon size={24} color={levelIconColor} strokeWidth={2} />
            <Text style={{ fontSize: 12, fontWeight: "600", color }}>
              {stats.level.name}
            </Text>
          </Pressable>
        </View>
      </View>
      <View
        style={[
          s.row,
          { justifyContent: "space-between", alignItems: "flex-end" },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: c.text }}>
            {user.name}
          </Text>
          <Text style={{ fontSize: 14, color: c.muted }}>@{user.username}</Text>
          <View style={[s.row, { gap: 12, marginTop: 4, flexWrap: "wrap" }]}>
            {[
              { rank: streaksRank, tab: "streaks" },
              { rank: pointsRank, tab: "points" },
            ]
              .filter((item) => item.rank)
              .map(({ rank, tab }) => (
                <Pressable
                  key={tab}
                  accessibilityRole="button"
                  accessibilityLabel={`Rank ${rank} ${tab}`}
                  onPress={() =>
                    router.push({ pathname: "/rankings", params: { tab } })
                  }
                >
                  <Text style={{ color: c.muted, fontSize: 12 }}>
                    {rank! <= 3 ? ["🥇", "🥈", "🥉"][rank! - 1] + " " : ""}#
                    {rank} {tab}
                  </Text>
                </Pressable>
              ))}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {(["streaks", "habits", "lifestyles"] as const).map((kind) => (
            <AchievementBadge
              key={kind}
              kind={kind}
              count={stats[kind]}
              onPress={() =>
                router.push({
                  pathname: "/badges",
                  params: { kind, userId: user.id },
                })
              }
            />
          ))}
        </View>
      </View>
      {!own && (
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <Button secondary busy={chat.isPending} onPress={() => chat.mutate()}>
            Message
          </Button>
          {!friend &&
            (received ? (
              <>
                <Button
                  busy={connection.isPending}
                  onPress={() => connection.mutate("accept")}
                >
                  Accept
                </Button>
                <Button
                  secondary
                  busy={connection.isPending}
                  onPress={() => connection.mutate("reject")}
                >
                  Decline
                </Button>
              </>
            ) : (
              <Button
                disabled={sent}
                busy={connection.isPending}
                onPress={() => connection.mutate("send")}
              >
                {sent ? "Request Sent" : "Add Friend"}
              </Button>
            ))}
        </View>
      )}
      <Status error={connection.error ?? chat.error} />
      {detail === "points" && (
        <ProgressSheet
          user={user}
          stats={stats}
          onClose={() => setDetail(undefined)}
        />
      )}
      <Sheet
        visible={detail === "friends"}
        title="Friends"
        onClose={() => setDetail(undefined)}
      >
        {friends.length ? (
          friends.map((person) => {
            const totalActivities = activityCount(person);
            const activityLabel = `${totalActivities} ${totalActivities === 1 ? "activity" : "activities"}`;

            return (
              <Pressable
                key={person.id}
                accessibilityRole="button"
                accessibilityLabel={`View ${person.name ?? person.username ?? "friend"}. ${activityLabel}`}
                onPress={() => {
                  setDetail(undefined);
                  router.push(`/profile/${person.username}`);
                }}
                style={({ pressed }) => ({
                  minHeight: 52,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: c.card,
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                {person.picture ? (
                  <Image
                    source={{ uri: person.picture }}
                    accessibilityLabel={`${person.name ?? person.username ?? "Friend"} profile photo`}
                    style={{ width: 42, height: 42, borderRadius: 21 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: c.soft,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: "700" }}>
                      {(person.name ?? person.username ?? "F")[0]}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: c.text, fontWeight: "600" }}>
                    {person.name ?? person.username ?? "Friend"}
                  </Text>
                  {person.username ? (
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                      @{person.username}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {activityLabel}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <Copy muted>No friends yet.</Copy>
        )}
      </Sheet>
    </View>
  );
}
