import { goBack } from "@/core/navigation";
import {
  Reveal,
  RevealContext,
  useRevealViewport,
} from "@/components/reveal/Reveal";
import { useRefresh } from "@/data/useRefresh";
import { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import { Text } from "@/components/typography/Text";
import { ChartColumn, History, ChevronLeft } from "lucide-react-native";
import { ProfileGlow } from "@/components/ProfileGlow";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  IconButton,
  Button,
  Copy,
  Heading,
  Panel,
  Status,
  s,
  useColors,
} from "@/components/ui";
import {
  useCurrentUser,
  useProfile,
  useEntries,
  usePlans,
  useActivities,
  useTimeline,
} from "@/data/queries";
import { PlanCard } from "../plans/PlanCard";
import { Heatmap } from "../plans/Heatmap";
import { FeedCard } from "../timeline/FeedCard";
import { EntryEditor } from "../activities/EntryEditor";
import { WrappedCard } from "../wrapped/WrappedCard";
import { ProfileHeader } from "./ProfileHeader";
import type { ActivityEntry, User } from "@/core/types";
import type { ProfileRow, ProfileScreenProps } from "./types";
export default function ProfileScreen({ username }: ProfileScreenProps) {
  const current = useCurrentUser();
  const own = !username || username === current.data?.username;
  const profile = useProfile(!own && current.data ? username : undefined);
  const myEntries = useEntries(own);
  const myActivities = useActivities(own);
  const myPlans = usePlans(own);
  const timeline = useTimeline();
  const [tab, setTab] = useState<"plans" | "history">("plans");
  const [editing, setEditing] = useState<ActivityEntry>();
  const c = useColors();
  const reveal = useRevealViewport();
  const user = useMemo<User | undefined>(
    () =>
      own && current.data
        ? {
            ...current.data,
            plans: myPlans.data ?? [],
            activities: myActivities.data ?? [],
            activityEntries: myEntries.data ?? [],
            achievementPosts: [
              ...new Map(
                (
                  timeline.data?.pages.flatMap(
                    (p) => p.achievementPosts ?? [],
                  ) ?? []
                )
                  .filter((p) => p.user.id === current.data.id)
                  .map((p) => [p.id, p]),
              ).values(),
            ],
          }
        : profile.data,
    [
      own,
      current.data,
      myPlans.data,
      myActivities.data,
      myEntries.data,
      timeline.data,
      profile.data,
    ],
  );
  const entries = useMemo(
    () => (user?.activityEntries ?? []).filter((e) => !e.deletedAt),
    [user?.activityEntries],
  );
  const rows = useMemo<ProfileRow[]>(() => {
    if (!user) return [];
    if (tab === "history") {
      const history = [
        ...[...new Map(entries.map((e) => [e.id, e])).values()].map(
          (entry) => ({
            id: `activity-${entry.id}`,
            date: new Date(entry.datetime).getTime(),
            entry,
            activity:
              user.activities?.find((a) => a.id === entry.activityId) ??
              entry.activity,
            user,
          }),
        ),
        ...(user.achievementPosts ?? []).map((achievement) => ({
          id: `achievement-${achievement.id}`,
          date: new Date(achievement.createdAt).getTime(),
          achievement,
        })),
      ].sort((a, b) => b.date - a.date);
      return history.map((item) => ({ type: "history", id: item.id, item }));
    }
    const plans = (user.plans ?? [])
      .filter(
        (p) =>
          !p.deletedAt &&
          !p.archivedAt &&
          (!p.finishingDate || new Date(p.finishingDate) > new Date()),
      )
      .sort(
        (a, b) =>
          (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    const inPlans = new Set(
      plans.flatMap((p) => p.activities.map((a) => a.id)),
    );
    const logged = new Set(entries.map((e) => e.activityId));
    const unplanned = (user.activities ?? []).filter(
      (a) => !a.deletedAt && !inPlans.has(a.id) && logged.has(a.id),
    );
    return [
      ...plans.map((plan) => ({ id: plan.id, type: "plan" as const, plan })),
      ...(unplanned.length
        ? [
            {
              id: "unplanned",
              type: "unplanned" as const,
              activities: unplanned,
            },
          ]
        : []),
    ];
  }, [user, entries, tab]);
  const { refresh, refreshing } = useRefresh(
    ...(own
      ? [
          "current-user",
          "activity-entries",
          "plans",
          "activities",
          "timeline",
          "rankings",
        ]
      : ["current-user", "profile", "rankings"]),
  );
  return (
    <RevealContext.Provider value={reveal}>
      <SafeAreaView
        testID="profile-screen"
        collapsable={false}
        edges={
          own && Platform.OS === "ios" ? ["left", "right"] : ["top", "left", "right"]
        }
        style={{ flex: 1, backgroundColor: c.bg }}
      >
        <ProfileGlow />
        {!own && <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 }}>
          <IconButton label="Back" icon={ChevronLeft} onPress={goBack} />
          <Text style={{ fontSize: 18, fontWeight: "600", color: c.text, marginLeft: 8 }}>Profile</Text>
        </View>}
        <FlatList<ProfileRow>
          onScroll={reveal.check}
          onContentSizeChange={reveal.check}
          scrollEventThrottle={100}
          alwaysBounceVertical
          contentInsetAdjustmentBehavior={own ? "automatic" : "never"}
          data={rows}
          keyExtractor={(row) => row.id}
          contentContainerStyle={s.screen}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          windowSize={7}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={c.accent}
            />
          }
          ListHeaderComponent={
            <View style={{ gap: 16, marginBottom: 16 }}>
              <Status
                loading={!user && (current.isPending || profile.isPending)}
                error={
                  own
                    ? (current.error ?? myPlans.error ?? myEntries.error)
                    : profile.error
                }
                retry={refresh}
              />
              {user && (
                <>
                  <Reveal id={`profile-header-${user.id}`}>
                    <ProfileHeader
                      user={user}
                      own={own}
                      current={current.data}
                    />
                  </Reveal>
                  {own && (
                    <Reveal id="profile-wrapped" delay={50}>
                      <WrappedCard />
                    </Reveal>
                  )}
                  <View style={[s.row, { gap: 0, marginTop: 12 }]}>
                    {(["plans", "history"] as const).map((value) => {
                      const Icon = value === "plans" ? ChartColumn : History;
                      return (
                        <Pressable
                          key={value}
                          accessibilityRole="button"
                          testID={`profile-tab-${value}`}
                          accessibilityLabel={
                            value === "plans" ? "Plans" : "History"
                          }
                          accessibilityState={{ selected: tab === value }}
                          onPress={() => setTab(value)}
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            paddingVertical: 16,
                            borderBottomWidth: 2,
                            borderColor: tab === value ? c.text : c.border,
                          }}
                        >
                          <Icon
                            size={20}
                            color={tab === value ? c.text : c.muted}
                          />
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "600",
                              color: tab === value ? c.text : c.muted,
                            }}
                          >
                            {value === "plans" ? "Plans" : "History"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Reveal id={`profile-${tab}-${item.id}`}>
              {item.type === "plan" ? (
                <PlanCard
                  plan={item.plan}
                  entries={entries}
                  own={own}
                  premium={current.data?.planType === "PLUS"}
                />
              ) : item.type === "history" ? (
                <FeedCard item={item.item} />
              ) : (
                <Panel>
                  <Heading>Non-plan activities</Heading>
                  <Heatmap
                    activities={item.activities}
                    entries={entries}
                    onEntryPress={own ? setEditing : undefined}
                    premium={current.data?.planType === "PLUS"}
                  />
                </Panel>
              )}
            </Reveal>
          )}
          ListEmptyComponent={
            user ? (
              <Copy muted>
                {tab === "plans"
                  ? own
                    ? "You haven't created any plans yet."
                    : `${user.name} hasn't got any public plans available.`
                  : own
                    ? "You haven't posted any activity or achievement yet."
                    : `${user.name} hasn't posted anything yet.`}
              </Copy>
            ) : null
          }
        />
        {editing && (
          <EntryEditor entry={editing} onClose={() => setEditing(undefined)} />
        )}
      </SafeAreaView>
    </RevealContext.Provider>
  );
}
