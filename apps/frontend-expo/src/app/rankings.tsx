import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import {
  Button,
  Copy,
  Heading,
  IconButton,
  Panel,
  Screen,
  Status,
  s,
  useColors,
} from "@/components/ui";
import { goBack } from "@/core/navigation";
import { useCurrentUser } from "@/data/queries";
import { useRankings } from "@/features/profile/rankings";
import { accountLevels } from "@/features/profile/model";
import type { RankedUser } from "@/features/profile/types";

export default function Rankings() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState(
    params.tab === "streaks" ? "streaks" : "points",
  );
  const query = useRankings();
  const me = useCurrentUser();
  const c = useColors();
  const users =
    (tab === "points"
      ? query.data?.pointsRanking
      : query.data?.streaksRanking) ?? [];
  const podium =
    users.length >= 2 ? [users[1], users[0], ...users.slice(2, 3)] : [];
  const rank =
    tab === "points"
      ? query.data?.currentUser.pointsRank
      : query.data?.currentUser.streaksRank;
  const rows: RankedUser[] = [...users];
  if (rank && rank > 10 && me.data?.username && query.data)
    rows.push({
      ...query.data.currentUser,
      rank,
      username: me.data.username,
      name: me.data.name,
      picture: me.data.picture,
    });
  return (
    <Screen
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <View style={s.row}>
        <IconButton icon={ChevronLeft} label="Back" onPress={goBack} />
        <Heading>Rankings</Heading>
      </View>
      <View
        style={[
          s.row,
          { backgroundColor: c.soft, borderRadius: 12, padding: 4 },
        ]}
      >
        {(["points", "streaks"] as const).map((value) => (
          <View key={value} style={{ flex: 1 }}>
            <Button secondary={tab !== value} onPress={() => setTab(value)}>
              {value === "points" ? "Points" : "Streaks"}
            </Button>
          </View>
        ))}
      </View>
      <Status
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={
          !users.length && !query.isPending
            ? `No ${tab === "points" ? "rankings" : "streaks"} data yet`
            : undefined
        }
      />
      {!!podium.length && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "flex-end",
            gap: 12,
            paddingTop: 24,
            paddingBottom: 12,
          }}
        >
          {podium.map((person) => {
            const color =
              person.rank === 1
                ? "#fbbf24"
                : person.rank === 2
                  ? "#94a3b8"
                  : "#cd7f32";
            return (
              <Pressable
                key={person.username}
                accessibilityRole="button"
                accessibilityLabel={`View ${person.username}`}
                onPress={() => router.push(`/profile/${person.username}`)}
                style={{
                  width: 96,
                  height: person.rank === 1 ? 128 : person.rank === 2 ? 96 : 88,
                  backgroundColor: `${color}15`,
                  borderWidth: 1,
                  borderColor: `${color}40`,
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  alignItems: "center",
                  paddingTop: 8,
                  gap: 3,
                }}
              >
                {person.picture ? (
                  <Image
                    source={{ uri: person.picture }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: `${color}30`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color, fontSize: 18, fontWeight: "700" }}>
                      {(person.name || person.username)[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text
                  numberOfLines={1}
                  style={{ color: c.text, fontSize: 10, maxWidth: 88 }}
                >
                  {person.username === me.data?.username
                    ? "You"
                    : (person.name || person.username).split(" ")[0]}
                </Text>
                <Text style={{ color, fontSize: 10, fontWeight: "700" }}>
                  {tab === "points" ? person.totalPoints : person.bestStreak}{" "}
                  {tab === "points" ? "pts" : "wks"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {rows.map((person) => {
        const level =
          accountLevels.findLast(
            (level) => person.totalPoints >= level.threshold,
          ) ?? accountLevels[0];
        const own = person.username === me.data?.username;
        const color = c.dark ? level.dark : level.light;
        return (
          <Pressable
            key={person.username}
            accessibilityRole="button"
            accessibilityLabel={`${person.name || person.username}, rank ${person.rank}`}
            onPress={() => router.push(`/profile/${person.username}`)}
          >
            <Panel
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 16,
                gap: 12,
                backgroundColor: own ? c.soft : c.card,
              }}
            >
              <Text style={{ color, width: 24, fontWeight: "700" }}>
                {person.rank}
              </Text>
              {person.picture && (
                <Image
                  source={{ uri: person.picture }}
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                />
              )}
              <View style={{ flex: 1 }}>
                <Copy>{own ? "You" : person.name || person.username}</Copy>
              </View>
              <Text
                style={{
                  color: tab === "streaks" ? "#fb923c" : color,
                  fontWeight: "600",
                }}
              >
                {tab === "points"
                  ? `${person.totalPoints.toLocaleString()} pts`
                  : `🔥 ${person.bestStreak} wks`}
              </Text>
            </Panel>
          </Pressable>
        );
      })}
    </Screen>
  );
}
