import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable as RNPressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Share, X } from "lucide-react-native";
import { Status } from "@/components/ui";
import { goBack } from "@/core/navigation";
import { api } from "@/data/api";
import {
  useActivities,
  useCurrentUser,
  useEntries,
  useMetricEntries,
  usePlans,
} from "@/data/queries";
import type { WrappedData, WrappedLeaderboard } from "./types";
import { storiesFor, WRAPPED_YEAR } from "./model";
import { StoryFrame, StoryText, useStoryColors } from "./ui";
import { shareStory } from "./share";
import { Hero } from "./stories/Hero";
import { World } from "./stories/World";
import { Journey } from "./stories/Journey";
import { Plans } from "./stories/Plans";
import { Mood } from "./stories/Mood";
import { Activities } from "./stories/Activities";
import { Leaderboard } from "./stories/Leaderboard";
import { StoryReducedMotion, useStoryMotionPreference } from "./Motion";
const Pressable = RNPressable;
export default function WrappedScreen() {
  const reducedMotion = useStoryMotionPreference();
  const transition = useRef(new Animated.Value(1)).current;
  const [transitioning, setTransitioning] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const user = useCurrentUser();
  const entries = useEntries();
  const metrics = useMetricEntries();
  const activities = useActivities();
  const plans = usePlans();
  const c = useStoryColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string>();
  const view = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const scores = useQuery({
    queryKey: ["wrapped-year-ranking-v3", WRAPPED_YEAR, user.data?.id],
    enabled: !!user.data,
    staleTime: 600000,
    queryFn: async () => {
      const result = (await api.get<WrappedLeaderboard>("/users/wrapped", { params: { year: WRAPPED_YEAR } })).data;
      if (result.year !== WRAPPED_YEAR || !Array.isArray(result.people) || !result.people.some(p => p.id === user.data?.id))
        throw new Error("The year's totals could not be verified. Please try again.");
      return result;
    },
  });
  const friends = scores.data?.people.filter(p => p.id !== user.data?.id) ?? [];
  const data = useMemo<WrappedData | undefined>(
    () =>
      user.data && entries.data && metrics.data && activities.data && plans.data && scores.data
        ? {
            year: WRAPPED_YEAR,
            user: user.data,
            entries: entries.data,
            metrics: metrics.data,
            activities: activities.data,
            plans: plans.data,
            friends: scores.data.people.filter(p => p.id !== user.data.id),
            self: scores.data.people.find(p => p.id === user.data.id)!,
            annualPlans: scores.data.plans,
          }
        : undefined,
    [
      user.data,
      entries.data,
      metrics.data,
      activities.data,
      plans.data,
      scores.data,
    ],
  );
  const stories = data ? storiesFor(data) : [];
  const story = stories[Math.min(index, stories.length - 1)];
  const error =
    user.error ??
    entries.error ??
    metrics.error ??
    activities.error ??
    plans.error ?? scores.error;
  const retry = () => {
    void Promise.all([
      user.refetch(),
      entries.refetch(),
      metrics.refetch(),
      activities.refetch(),
      plans.refetch(),
      scores.refetch(),
    ]);
  };
  const loaded = !!data && !error && !scores.isPending;
  useEffect(() => {
    setContentReady(false);
    if (!loaded) return;
    if (reducedMotion) {
      setContentReady(true);
      return;
    }
    // Sharing waits for the last staggered row and podium to finish revealing.
    const duration = story === "friends" || story === "streaks"
      ? Math.max(1200, 1050 + friends.length * 50)
      : story === "hero" ? 200 : 1200;
    const timer = setTimeout(() => setContentReady(true), duration);
    return () => clearTimeout(timer);
  }, [story, loaded, reducedMotion, friends.length]);
  useEffect(() => {
    if (!loaded) return;
    transition.stopAnimation();
    if (reducedMotion) {
      transition.setValue(1);
      setTransitioning(false);
      return;
    }
    transition.setValue(0);
    setTransitioning(true);
    const enter = Animated.timing(transition, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    enter.start(({ finished }) => {
      if (finished) {
        setTransitioning(false);
      }
    });
    return () => enter.stop();
  }, [story, loaded, reducedMotion, transition]);
  const change = (next: number) => {
    if (next >= stories.length) {
      goBack();
      return;
    }
    next = Math.max(0, next);
    if (next === index) return;
    const navigate = () => {
      setIndex(next);
      setShareError(undefined);
      scroll.current?.scrollTo({ y: 0, animated: false });
    };
    if (reducedMotion) {
      navigate();
      return;
    }
    transition.stopAnimation();
    setTransitioning(true);
    Animated.timing(transition, {
      toValue: 2,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (finished) navigate();
    });
  };
  const share = async () => {
    if (sharing) return;
    setSharing(true);
    setShareError(undefined);
    try {
      await shareStory({ view, year: WRAPPED_YEAR });
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        setShareError((error as Error).message);
    } finally {
      setSharing(false);
    }
  };
  return (
    <StoryReducedMotion.Provider value={reducedMotion}>
      <GestureHandlerRootView
        testID="wrapped-screen"
        style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}
        accessibilityActions={[
          { name: "increment", label: "Next story" },
          { name: "decrement", label: "Previous story" },
        ]}
        onAccessibilityAction={(e) =>
          change(index + (e.nativeEvent.actionName === "increment" ? 1 : -1))
        }
      >
        <View
          style={{
            zIndex: 10,
            flexDirection: "row",
            gap: 4,
            paddingHorizontal: 8,
            paddingTop: 8,
          }}
        >
          {stories.map((s, i) => (
            <View key={s} style={{ flex: 1 }}>
              <Pressable
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Go to ${s} story`}
                accessibilityState={{ selected: index === i }}
                onPress={() => change(i)}
                style={{ height: 44, width: "100%", justifyContent: "center" }}
              >
                <View
                  style={{
                    height: 4,
                    borderRadius: 4,
                    backgroundColor: i <= index ? c.text : `${c.text}33`,
                  }}
                />
              </Pressable>
            </View>
          ))}
        </View>
        <View
          style={{
            zIndex: 10,
            height: 44,
            flexDirection: "row",
            justifyContent: "flex-end",
            paddingHorizontal: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share wrapped story"
            disabled={sharing || !data || transitioning || !contentReady}
            onPress={() => void share()}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {sharing ? (
              <ActivityIndicator color={c.text} />
            ) : (
              <Share size={24} color={c.text} />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close wrapped"
            onPress={goBack}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={24} color={c.text} />
          </Pressable>
        </View>
        {shareError && (
          <StoryText
            accessibilityRole="alert"
            style={{ paddingHorizontal: 24, color: "#ef4444" }}
          >
            {shareError}
          </StoryText>
        )}
        {!data || error || scores.isPending ? (
          <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
            <Status loading={!error} error={error} retry={retry} />
          </View>
        ) : (
          <ScrollView
            ref={scroll}
            testID="wrapped-scroll"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: insets.bottom,
            }}
          >
            <RNPressable
              accessible={false}
              style={{ flexGrow: 1 }}
              onPress={(e) => {
                if (e.nativeEvent.pageX < width * 0.3) change(index - 1);
                else if (e.nativeEvent.pageX > width * 0.7) change(index + 1);
              }}
            >
              <Animated.View
                testID="wrapped-story-transition"
                style={{
                  flexGrow: 1,
                  opacity: transition.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [0, 1, 0],
                  }),
                  transform: [
                    {
                      translateX: transition.interpolate({
                        inputRange: [0, 1, 2],
                        outputRange: [50, 0, -50],
                      }),
                    },
                  ],
                }}
              >
                <StoryFrame
                  captureRef={view}
                  center={story === "hero"}
                  accent={
                    story === "activities"
                      ? "#f59e0b"
                      : story === "mood"
                        ? "#10b981"
                        : story === "streaks"
                          ? "#ef4444"
                          : story === "world"
                            ? c.accent
                            : "#8b5cf6"
                  }
                >
                  <View
                    key={story}
                    testID={`wrapped-story-${story}`}
                    style={{ gap: 20 }}
                  >
                    {story === "hero" ? (
                      <Hero data={data} />
                    ) : story === "world" ? (
                      <World data={data} />
                    ) : story === "journey" ? (
                      <Journey data={data} />
                    ) : story === "plans" ? (
                      <Plans data={data} />
                    ) : story === "mood" ? (
                      <Mood data={data} />
                    ) : story === "activities" ? (
                      <Activities data={data} />
                    ) : (
                      <Leaderboard data={data} streaks={story === "streaks"} />
                    )}
                  </View>
                </StoryFrame>
              </Animated.View>
            </RNPressable>
            {scores.error && (
              <View style={{ padding: 16 }}>
                <Status
                  error={new Error("Friend leaderboards could not be loaded.")}
                  retry={() => void scores.refetch()}
                />
              </View>
            )}
          </ScrollView>
        )}
      </GestureHandlerRootView>
    </StoryReducedMotion.Provider>
  );
}
