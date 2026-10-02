import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { ChevronDown, CircleHelp } from "lucide-react-native";
import { Reveal } from "@/components/reveal/Reveal";
import { Copy, IconButton, Panel, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { useCurrentUser } from "@/data/queries";
import { coachAvatar } from "@/features/coach/avatar";
import { coachIdentity } from "@/features/messages/coach";
import { PreviewSheet } from "@/features/messages/entities/PreviewSheet";
import {
  CLEAR_DIFFERENCE,
  MIN_SLEEP_PAIRS,
  signalStrength,
  sleepActivity,
} from "./model";
import {
  CAVEAT,
  activityDetail,
  countUp,
  headline,
  moreWaiting,
  percent,
  signalLine,
  waitingForActivity,
  waitingForSleep,
} from "./words";
import type {
  FindingDetail,
  FindingRowProps,
  MetricInsightsProps,
  SleepDetailProps,
} from "./types";

// Too-early rows shown before the rest fold into one line. An account with
// many one-off activities would otherwise bury its findings under them.
const WAITING_SHOWN = 1;
// A bar is full at a 50% difference; larger ones are rare on a 1-5 scale.
const FULL_BAR = 0.5;
// Ratings run 1-5, so each sleep band is drawn against that fixed scale.
// Scaling to the tallest band would make an average of 3.5 look perfect.
const RATING_MAX = 5;

// Three rising bars, like phone reception: how much there is to go on.
function Signal({ strength }: { strength: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
      {[6, 10, 14].map((height, index) => (
        <View
          key={height}
          style={{
            width: 4,
            height,
            borderRadius: 1,
            backgroundColor: index < strength ? c.muted : c.soft,
          }}
        />
      ))}
    </View>
  );
}

// One signal each: bar colour is the direction, the number and bar length are
// the size, and the small bars are how much there is to go on.
function FindingRow({
  testID,
  label,
  difference,
  signal,
  waiting,
  onPress,
}: FindingRowProps) {
  const c = useColors();
  const progress = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const size = Math.min(Math.abs(difference ?? 0) / FULL_BAR, 1) * 100;
  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      progress.setValue(size);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: size,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, reducedMotion, size, progress]);
  return (
    <Reveal
      onReveal={(reduced) => {
        setReducedMotion(reduced);
        setVisible(true);
      }}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${difference === null ? waiting : percent(difference)}, signal ${signal} of 3`}
        onPress={onPress}
        style={({ pressed }) => ({
          gap: 8,
          opacity: pressed ? 0.6 : difference === null ? 0.45 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 15, color: c.text, flexShrink: 1 }}>
            {label}
          </Text>
          <Signal strength={signal} />
          <View style={{ flex: 1 }} />
          <Text
            style={{
              fontSize: 15,
              fontWeight: difference === null ? "400" : "600",
              color: difference === null ? c.muted : c.text,
              fontVariant: ["tabular-nums"],
            }}
          >
            {difference === null ? waiting : percent(difference)}
          </Text>
        </View>
        <View
          accessibilityRole="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={size}
          accessibilityLabel={`${label} difference`}
          accessibilityValue={{ min: 0, max: 100, now: size }}
          style={{
            height: 10,
            borderRadius: 999,
            overflow: "hidden",
            backgroundColor: c.soft,
          }}
        >
          <Animated.View
            style={{
              height: "100%",
              borderRadius: 999,
              backgroundColor:
                Math.abs(difference ?? 0) < CLEAR_DIFFERENCE
                  ? "#9ca3af"
                  : (difference ?? 0) > 0
                    ? "#22c55e"
                    : "#ef4444",
              width: progress.interpolate({
                inputRange: [0, 100],
                outputRange: ["0%", "100%"],
              }),
            }}
          />
        </View>
      </Pressable>
    </Reveal>
  );
}

function SleepDetail({ sleep, metric }: SleepDetailProps) {
  const c = useColors();
  const metricName = metric.title.toLowerCase();
  const nightsNeeded = MIN_SLEEP_PAIRS - sleep.sampleSize;
  return (
    <>
      <Copy>
        {!sleep.comparable
          ? `Check in after ${nightsNeeded} more night${nightsNeeded === 1 ? "" : "s"} to see how your ${metricName} follows your sleep.`
          : sleep.higherAverage === null || sleep.lowerAverage === null
            ? "Check in after more scored nights to compare good nights with the rest."
            : `After nights scoring 80+, ${metricName} averages ${sleep.higherAverage.toFixed(1)}, against ${sleep.lowerAverage.toFixed(1)} after other nights.`}
      </Copy>
      <View style={{ gap: 8 }}>
        {sleep.bands.map((band) => (
          <View key={band.label} style={{ gap: 4 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 13, color: c.text }}>{band.label}</Text>
              <Text style={{ fontSize: 13, color: c.muted }}>
                {band.average === null
                  ? "No rated days"
                  : `${band.average.toFixed(1)} average`}
              </Text>
            </View>
            <View
              accessibilityRole="progressbar"
              aria-valuemin={0}
              aria-valuemax={RATING_MAX}
              aria-valuenow={band.average ?? 0}
              accessibilityLabel={`${band.label} average rating`}
              accessibilityValue={{
                min: 0,
                max: RATING_MAX,
                now: band.average ?? 0,
              }}
              style={{
                height: 8,
                borderRadius: 999,
                overflow: "hidden",
                backgroundColor: c.soft,
              }}
            >
              <View
                style={{
                  height: "100%",
                  backgroundColor: c.muted,
                  width: `${((band.average ?? 0) / RATING_MAX) * 100}%`,
                }}
              />
            </View>
          </View>
        ))}
      </View>
      {sleep.estimatedNights > 0 && (
        <Copy muted>
          {sleep.estimatedNights === 1
            ? "1 night is estimated from its measured components while its score is still learning."
            : `${sleep.estimatedNights} nights are estimated from their measured components while their scores are still learning.`}
        </Copy>
      )}
      <Copy muted>
        {signalLine(sleep.sampleSize, "night", MIN_SLEEP_PAIRS)} Each check-in
        is paired with the night that ended that morning.
      </Copy>
    </>
  );
}

export function MetricInsights({
  metric,
  checkIns,
  findings,
  sleep,
}: MetricInsightsProps) {
  const c = useColors();
  const personality = useCurrentUser().data?.coachPersonality;
  const coach = coachIdentity(personality);
  const [detail, setDetail] = useState<FindingDetail>();
  const [allWaiting, setAllWaiting] = useState(false);
  const counting = checkIns < 7;
  // Findings arrive with the too-early rows last.
  const measured = findings.filter((row) => row.difference !== null).length;
  const folded = allWaiting
    ? 0
    : Math.max(0, findings.length - measured - WAITING_SHOWN);
  const shown = findings.slice(0, findings.length - folded);
  const heading =
    detail?.kind === "activity"
      ? `${detail.finding.activity.emoji || "📊"} ${detail.finding.activity.title}`
      : detail?.kind === "sleep"
        ? `${sleepActivity.emoji} ${sleepActivity.title}`
        : "How to read this";
  return (
    <Panel
      testID="metric-insights-island"
      style={{ padding: 20, borderRadius: 16, gap: 16 }}
    >
      {/* Anything that helps someone stay consistent comes from the coach. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Image
          source={coachAvatar(personality === "STRATEGIST")}
          style={{ width: 36, height: 36 }}
          contentFit="contain"
        />
        <Text
          style={{ flex: 1, fontSize: 16, fontWeight: "600", color: c.text }}
        >
          {coach.name}
        </Text>
        {!counting && (
          <IconButton
            label="How to read this"
            icon={CircleHelp}
            onPress={() => setDetail({ kind: "help" })}
          />
        )}
      </View>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 20,
          lineHeight: 26,
          fontWeight: "700",
          color: c.text,
        }}
      >
        {counting ? countUp(checkIns) : headline(metric.title, findings, sleep)}
      </Text>
      {counting ? (
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.soft }}>
          <View
            style={{
              height: 8,
              borderRadius: 4,
              width: `${(checkIns / 7) * 100}%`,
              backgroundColor: c.accent,
            }}
          />
        </View>
      ) : (
        (sleep || findings.length > 0) && (
          <View style={{ gap: 16 }}>
            {sleep && (
              <FindingRow
                testID="finding-sleep-score"
                label={`${sleepActivity.emoji} ${sleepActivity.title}`}
                difference={sleep.difference}
                signal={signalStrength(sleep.sampleSize, MIN_SLEEP_PAIRS)}
                waiting={waitingForSleep(sleep)}
                onPress={() => setDetail({ kind: "sleep" })}
              />
            )}
            {shown.map((finding) => (
              <FindingRow
                key={`${metric.id}-${finding.activity.id}`}
                testID={`finding-${finding.activity.id}`}
                label={`${finding.activity.emoji || "📊"} ${finding.activity.title}`}
                difference={finding.difference}
                signal={signalStrength(
                  Math.min(finding.days, finding.otherDays),
                )}
                waiting={waitingForActivity(finding)}
                onPress={() => setDetail({ kind: "activity", finding })}
              />
            ))}
            {folded > 0 && (
              <Pressable
                testID="findings-more"
                accessibilityRole="button"
                accessibilityLabel={moreWaiting(folded)}
                onPress={() => setAllWaiting(true)}
                hitSlop={8}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ fontSize: 13, color: c.muted }}>
                  {moreWaiting(folded)}
                </Text>
                <ChevronDown size={14} color={c.muted} />
              </Pressable>
            )}
          </View>
        )
      )}
      <PreviewSheet
        visible={detail !== undefined}
        title={heading}
        onClose={() => setDetail(undefined)}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: c.text,
            paddingRight: 36,
          }}
        >
          {heading}
        </Text>
        {detail?.kind === "activity" && (
          <>
            {activityDetail(metric.title, detail.finding).map((line) => (
              <Copy key={line}>{line}</Copy>
            ))}
            {detail.finding.difference !== null && (
              <Copy muted>
                {signalLine(
                  Math.min(detail.finding.days, detail.finding.otherDays),
                  "day",
                )}
              </Copy>
            )}
          </>
        )}
        {detail?.kind === "sleep" && sleep && (
          <SleepDetail sleep={sleep} metric={metric} />
        )}
        {detail?.kind === "help" && (
          <>
            <Copy>
              I compare how you rate your {metric.title.toLowerCase()} on the
              days you logged an activity with the days you didn't.
            </Copy>
            <Copy>
              The number is how much higher or lower it averages on those days.
              A longer bar is a bigger difference.
            </Copy>
            <Copy>
              The three small bars are how much there is to go on: one from 5
              days, two from 15, three from 30.
            </Copy>
          </>
        )}
        <Copy muted>{CAVEAT}</Copy>
      </PreviewSheet>
    </Panel>
  );
}
