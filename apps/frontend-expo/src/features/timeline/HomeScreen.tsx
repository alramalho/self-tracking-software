import {
  Reveal,
  RevealContext,
  useRevealViewport,
} from "@/components/reveal/Reveal";
import { useRefresh } from "@/data/useRefresh";
import { Bell, Search, Send } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Image,
  Pressable,
  RefreshControl,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useScrollToTop } from "expo-router";
import {
  useCurrentUser,
  useEntries,
  useMetrics,
  useMetricEntries,
  usePlans,
  useTimeline,
} from "@/data/queries";
import {
  IconButton,
  Copy,
  Heading,
  Status,
  s,
  useColors,
} from "@/components/ui";
import { FollowThroughHome } from "@/features/follow-through/HomeCards";
import { startOfDay } from "date-fns";
import { mergeTimeline } from "./model";
import { FeedCard } from "./FeedCard";
import { PlanPreview } from "./home-cards/PlanPreview";
import { MetricPreview } from "./home-cards/MetricPreview";
import { HealthHomeCard } from "@/features/health/HealthHomeCard";
import { MetricLogger } from "../metrics/MetricLogger";
import { useTimelineSeen } from "./useTimelineSeen";
import type { TimelineRow } from "./types";
import { containsEntry, timelineRows } from "./layout";
import { ProfileGlow } from "@/components/ProfileGlow";
import { PendingVoiceLogCard } from "@/features/voice-log/PendingVoiceLogCard";
import { VoiceLogDrawer } from "@/features/voice-log/VoiceLogDrawer";
import { usePendingVoiceLog } from "@/features/voice-log/usePendingVoiceLog";
export default function HomeScreen() {
  const timeline = useTimeline();
  const plans = usePlans();
  const entries = useEntries();
  const user = useCurrentUser();
  const metrics = useMetrics();
  const metricEntries = useMetricEntries();
  const [checkin, setCheckin] = useState(false);
  const [voiceLogOpen, setVoiceLogOpen] = useState(false);
  const pendingVoice = usePendingVoiceLog();
  const { refresh, refreshing } = useRefresh(
    "timeline",
    "follow-through",
    "current-user",
    "plans",
    "activity-entries",
    "metrics",
    "metric-entries",
  );
  const c = useColors();
  const reveal = useRevealViewport();
  const items = useMemo(
    () => mergeTimeline(timeline.data?.pages ?? []),
    [timeline.data],
  );
  const active = [...(plans.data ?? [])]
    .filter((p) => !p.deletedAt && !p.archivedAt)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const { rows: seenRows, onViewableItemsChanged } = useTimelineSeen(
    user.data,
    items,
  );
  const { activityEntryId } = useLocalSearchParams<{
    activityEntryId?: string;
  }>();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const rows = timelineRows(seenRows, expanded, activityEntryId);
  const list = useRef<FlatList<TimelineRow>>(null);
  useScrollToTop(list);
  const target = rows.findIndex(
    (row) =>
      (row.item && containsEntry(row.item, activityEntryId)) ||
      (row.secondary && containsEntry(row.secondary, activityEntryId)),
  );
  const scrolledTo = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!activityEntryId || scrolledTo.current === activityEntryId) return;
    if (target >= 0) {
      const timer = setTimeout(() => {
        list.current?.scrollToIndex({
          index: target,
          viewPosition: 0.25,
          animated: true,
        });
        scrolledTo.current = activityEntryId;
      }, 250);
      return () => clearTimeout(timer);
    }
    if (
      timeline.hasNextPage &&
      !timeline.isFetching &&
      !timeline.isFetchNextPageError
    )
      void timeline.fetchNextPage();
  }, [
    activityEntryId,
    target,
    timeline.hasNextPage,
    timeline.isFetching,
    timeline.isFetchNextPageError,
    timeline.fetchNextPage,
  ]);
  return (
    <RevealContext.Provider value={reveal}>
      <SafeAreaView
        collapsable={false}
        edges={
          Platform.OS === "ios" ? ["left", "right"] : ["top", "left", "right"]
        }
        style={{ flex: 1, backgroundColor: c.bg }}
      >
        <FlatList
          ref={list}
          testID="home-feed"
          style={{ zIndex: 1 }}
          onScroll={reveal.check}
          onContentSizeChange={reveal.check}
          scrollEventThrottle={100}
          alwaysBounceVertical
          contentInsetAdjustmentBehavior="automatic"
          data={rows}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) =>
            item.item ? (
              <View
                testID="timeline-row"
                style={{ flexDirection: "row", gap: 16 }}
              >
                {[item.item, item.secondary].filter(Boolean).map(
                  (card) =>
                    card && (
                      <Reveal
                        id={`home-${card.id}`}
                        key={card.id}
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <FeedCard
                          item={card}
                          compactInitially
                          expanded={expanded.has(card.id)}
                          onExpandedChange={(value) =>
                            setExpanded((previous) => {
                              const next = new Set(previous);
                              if (value) next.add(card.id);
                              else next.delete(card.id);
                              return next;
                            })
                          }
                          highlighted={containsEntry(card, activityEntryId)}
                        />
                      </Reveal>
                    ),
                )}
                {item.compact && !item.secondary && (
                  <View style={{ flex: 1 }} />
                )}
              </View>
            ) : (
              <View
                testID="timeline-seen-divider"
                style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}
              >
                <Copy>✓</Copy>
                <Heading>You're all caught up</Heading>
                <Copy muted>You've seen all new posts</Copy>
              </View>
            )
          }
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            list.current?.scrollToOffset({
              offset: index * averageItemLength,
              animated: false,
            });
            setTimeout(
              () =>
                list.current?.scrollToIndex({
                  index,
                  viewPosition: 0.25,
                  animated: true,
                }),
              300,
            );
          }}
          contentContainerStyle={s.screen}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={c.accent}
            />
          }
          onEndReached={() => {
            if (
              timeline.hasNextPage &&
              !timeline.isFetchingNextPage &&
              !timeline.isFetchNextPageError
            )
              void timeline.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
          ListHeaderComponent={
            <View style={{ gap: 16, marginBottom: 16 }}>
              {pendingVoice.draft && (
                <PendingVoiceLogCard
                  draft={pendingVoice.draft}
                  onReview={() => setVoiceLogOpen(true)}
                  onDismiss={() => {
                    setVoiceLogOpen(false);
                    void pendingVoice.clear();
                  }}
                />
              )}
              <HealthHomeCard />
              <View style={s.row}>
                <Pressable
                  onPress={() => router.push("/(tabs)/profile")}
                  style={[s.row, { flex: 1 }]}
                >
                  {user.data?.picture && (
                    <Image
                      source={{ uri: user.data.picture }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                  )}
                  <Heading>
                    {user.data?.name ?? user.data?.username ?? "tracking.so"}
                  </Heading>
                </Pressable>
                <IconButton
                  label="Search"
                  icon={Search}
                  onPress={() => router.push("/search")}
                />
                <IconButton
                  label="Notifications"
                  icon={Bell}
                  onPress={() => router.push("/notifications")}
                />
                <IconButton
                  label="Messages"
                  icon={Send}
                  onPress={() => router.push("/messages")}
                />
              </View>
              <Status error={user.error} retry={() => void user.refetch()} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {!!metrics.data?.length && user.data?.planType !== "FREE" && (
                  <Reveal id="home-metrics" style={{ width: "48%" }}>
                    <MetricPreview
                      metrics={metrics.data}
                      entries={metricEntries.data ?? []}
                      onLog={() => setCheckin(true)}
                    />
                  </Reveal>
                )}
                {active
                  .filter(
                    (p) =>
                      p.outlineType === "TIMES_PER_WEEK" ||
                      (p.finishingDate &&
                        new Date(p.finishingDate) < startOfDay(new Date())) ||
                      !p.sessions?.some(
                        (session) =>
                          new Date(session.date) >= startOfDay(new Date()),
                      ),
                  )
                  .map((plan) => (
                    <Reveal
                      id={`home-plan-${plan.id}`}
                      key={plan.id}
                      style={{ width: "48%" }}
                    >
                      <PlanPreview plan={plan} entries={entries.data ?? []} />
                    </Reveal>
                  ))}
                <FollowThroughHome plans={active} entries={entries.data ?? []} />
              </View>
              <View style={s.row}>
                <Heading>Friend's last activities</Heading>
                <Copy muted>({items.length})</Copy>
              </View>
            </View>
          }
          ListEmptyComponent={
            <Status
              loading={timeline.isPending}
              error={timeline.error}
              retry={() => void timeline.refetch()}
              empty="No activity yet. Find friends to see what they're up to."
            />
          }
          ListFooterComponent={
            timeline.isFetchingNextPage ? (
              <Status loading />
            ) : timeline.isFetchNextPageError ? (
              <Status
                error={timeline.error}
                retry={() => void timeline.fetchNextPage()}
              />
            ) : items.length && !timeline.hasNextPage ? (
              <Copy muted>You're all caught up!</Copy>
            ) : null
          }
        />
        <ProfileGlow />
        {checkin && <MetricLogger onClose={() => setCheckin(false)} />}
        {voiceLogOpen && pendingVoice.draft && (
          <VoiceLogDrawer
            initialDraft={pendingVoice.draft}
            onPendingChange={pendingVoice.sync}
            onClose={() => setVoiceLogOpen(false)}
          />
        )}
      </SafeAreaView>
    </RevealContext.Provider>
  );
}
