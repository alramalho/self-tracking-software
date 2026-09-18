import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import {
  ChevronDown,
  ChevronUp,
  CircleDashed,
  CircleHelp,
} from "lucide-react-native";
import { Reveal } from "@/components/reveal/Reveal";
import { Copy, IconButton, Panel, Sheet, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import {
  correlationAppearance,
  MIN_SLEEP_PAIRS,
  sleepActivity,
} from "./model";
import type {
  CorrelationRowProps,
  MetricInsightsProps,
  ReliabilitySample,
  SleepRowProps,
} from "./types";

const percent = (value: number) =>
  `${value >= 0 ? "+ " : "– "}${(Math.abs(value) * 100).toFixed(0)}%`;

const bandLabel = (average: number | null) =>
  average === null ? "No rated days" : `${average.toFixed(1)} avg rating`;

// Sleep is presented as one more contributor, but its bars are the average
// check-in rating for each sleep band rather than a logged activity count.
// Ratings run 0-5, so each bar is drawn against that same fixed scale. Scaling
// to the tallest band would make an average of 3.5 look like a perfect score.
const RATING_MAX = 5;
function SleepRow({ sleep, metric, onReliability }: SleepRowProps) {
  const c = useColors();
  const appearance = correlationAppearance(sleep.correlation, sleep.sampleSize);
  const [expanded, setExpanded] = useState(false);
  const nightsNeeded = MIN_SLEEP_PAIRS - sleep.sampleSize;
  return (
    <View
      testID="correlation-sleep-score"
      style={{ gap: 8, opacity: appearance.insufficient ? 0.4 : 1 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 14, color: c.text, flexShrink: 1 }}>
            {sleepActivity.emoji} {sleepActivity.title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sleep score reliability: ${appearance.label}`}
            onPress={onReliability}
            hitSlop={8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
            }}
          >
            {appearance.insufficient ? (
              <CircleDashed size={12} color={c.muted} />
            ) : (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: appearance.dot,
                }}
              />
            )}
            <Text
              style={{
                fontSize: 12,
                fontWeight: "500",
                color: appearance.insufficient
                  ? c.muted
                  : c.dark
                    ? appearance.darkLabel
                    : appearance.dot,
              }}
            >
              {appearance.label}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sleep score details"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((value) => !value)}
            hitSlop={8}
            style={{
              paddingHorizontal: 6,
              paddingVertical: 4,
              borderRadius: 6,
            }}
          >
            {expanded ? (
              <ChevronUp size={14} color={c.muted} strokeWidth={1.9} />
            ) : (
              <ChevronDown size={14} color={c.muted} strokeWidth={1.9} />
            )}
          </Pressable>
        </View>
        <Text
          style={{ color: appearance.color, fontWeight: "500", fontSize: 14 }}
        >
          {sleep.correlation === null ? "—" : percent(sleep.correlation)}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.abs(sleep.correlation ?? 0) * 100}
        accessibilityLabel="Sleep score correlation magnitude"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.abs(sleep.correlation ?? 0) * 100,
        }}
        style={{
          height: 12,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: c.soft,
        }}
      >
        <View
          style={{
            height: "100%",
            backgroundColor: appearance.color,
            width: `${Math.abs(sleep.correlation ?? 0) * 100}%`,
          }}
        />
      </View>
      {expanded && (
        <View style={{ gap: 10, paddingTop: 2 }}>
          <View style={{ gap: 8 }}>
            {sleep.bands.map((band) => (
              <View key={band.label} style={{ gap: 4 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <Text style={{ fontSize: 13, color: c.text }}>
                    {band.label}
                  </Text>
                  <Text style={{ fontSize: 13, color: c.muted }}>
                    {band.count ? bandLabel(band.average) : "No rated days"}
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
                      backgroundColor: appearance.color,
                      width: `${((band.average ?? 0) / RATING_MAX) * 100}%`,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
          <Copy muted>
            {!sleep.comparable
              ? `Compare ${nightsNeeded} more night${nightsNeeded === 1 ? "" : "s"} with a check-in to measure how your ${metric.title.toLowerCase()} follows your sleep.`
              : sleep.higherAverage === null || sleep.lowerAverage === null
                ? "Log more check-ins on scored nights to compare your sleep bands."
                : `After nights scoring 80+, ${metric.title.toLowerCase()} averages ${sleep.higherAverage.toFixed(1)} versus ${sleep.lowerAverage.toFixed(1)} after other nights.`}
          </Copy>
          {sleep.estimatedNights > 0 && (
            <Copy muted>
              {sleep.estimatedNights === 1
                ? "1 night is estimated from its measured components while its score is still learning."
                : `${sleep.estimatedNights} nights are estimated from their measured components while their scores are still learning.`}
            </Copy>
          )}
        </View>
      )}
    </View>
  );
}
function CorrelationRow({ row, onReliability }: CorrelationRowProps) {
  const c = useColors();
  const appearance = correlationAppearance(row.correlation, row.sampleSize);
  const progress = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const target = Math.abs(row.correlation) * 100;
    if (reducedMotion) {
      progress.setValue(target);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: target,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, reducedMotion, row.correlation, progress]);
  return (
    <Reveal
      onReveal={(reduced) => {
        setReducedMotion(reduced);
        setVisible(true);
      }}
    >
      <View
        testID={`correlation-${row.activity.id}`}
        style={{ gap: 8, opacity: appearance.insufficient ? 0.4 : 1 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 14, color: c.text, flexShrink: 1 }}>
              {row.activity.emoji || "📊"} {row.activity.title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${row.activity.title} reliability: ${appearance.label}`}
              onPress={onReliability}
              hitSlop={8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
              }}
            >
              {appearance.insufficient ? (
                <CircleDashed size={12} color={c.muted} />
              ) : (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: appearance.dot,
                  }}
                />
              )}
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "500",
                  color: appearance.insufficient
                    ? c.muted
                    : c.dark
                      ? appearance.darkLabel
                      : appearance.dot,
                }}
              >
                {appearance.label}
              </Text>
            </Pressable>
          </View>
          <Text
            style={{ color: appearance.color, fontWeight: "500", fontSize: 14 }}
          >
            {row.correlation >= 0 ? "+ " : "– "}
            {(Math.abs(row.correlation) * 100).toFixed(0)}%
          </Text>
        </View>
        <View
          accessibilityRole="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.abs(row.correlation)*100}
          accessibilityLabel={`${row.activity.title} correlation magnitude`}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: Math.abs(row.correlation) * 100,
          }}
          style={{
            height: 12,
            borderRadius: 999,
            overflow: "hidden",
            backgroundColor: c.soft,
          }}
        >
          <Animated.View
            style={{
              height: "100%",
              backgroundColor: appearance.color,
              width: progress.interpolate({
                inputRange: [0, 100],
                outputRange: ["0%", "100%"],
              }),
            }}
          />
        </View>
      </View>
    </Reveal>
  );
}
export function MetricInsights({
  metric,
  correlations,
  sleep,
  onHelp,
}: MetricInsightsProps) {
  const c = useColors();
  const [sample, setSample] = useState<ReliabilitySample>();
  const level = correlationAppearance(0, sample?.count ?? 0);
  const count = sample?.count ?? 0;
  const next = count < 5 ? 5 : count < 15 ? 15 : 30;
  return (
    <Panel
      testID="metric-insights-island"
      style={{ padding: 24, borderRadius: 16, gap: 24 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 36 }}>{metric.emoji}</Text>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 18, fontWeight: "700", color: c.text }}
        >
          {metric.title} Insights
        </Text>
        <IconButton
          label="About correlations"
          icon={CircleHelp}
          onPress={onHelp}
        />
      </View>
      <View style={{ gap: 16 }}>
        {sleep && (
          <SleepRow
            sleep={sleep}
            metric={metric}
            onReliability={() =>
              setSample({ count: sleep.sampleSize, kind: "sleep" })
            }
          />
        )}
        {correlations.length ? (
          correlations.map((row) => (
            <CorrelationRow
              key={`${metric.id}-${row.activity.id}`}
              row={row}
              onReliability={() =>
                setSample({ count: row.sampleSize, kind: "activity" })
              }
            />
          ))
        ) : !sleep ? (
          <Copy muted>No clear activity correlations yet.</Copy>
        ) : null}
      </View>
      <Sheet
        visible={sample !== undefined}
        title="Data Reliability"
        onClose={() => setSample(undefined)}
      >
        <Panel>
          <Copy>
            {sample?.kind === "sleep"
              ? `Nights compared: ${count}`
              : `Current Data Points: ${count}`}
          </Copy>
          <Copy>
            {sample !== undefined && count < 30
              ? sample.kind === "sleep"
                ? `Compare ${next - count} more night${next - count === 1 ? "" : "s"} to reach ${next === 5 ? "Weak" : next === 15 ? "Medium" : "Confident"} reliability`
                : `Log ${next - count} more time${next - count === 1 ? "" : "s"} to reach ${next === 5 ? "Weak" : next === 15 ? "Medium" : "Confident"} reliability`
              : "Maximum reliability achieved!"}
          </Copy>
          <Copy muted>{level.label}</Copy>
        </Panel>
        <Copy muted>
          {sample?.kind === "sleep"
            ? "Sleep pairs each check-in with the night that ended that morning. Correlation does not establish cause."
            : "The reliability indicator reflects how much data is available for each correlation. Correlation does not establish cause."}
        </Copy>
        <Copy>Confident · 30+ data points</Copy>
        <Copy>Medium · 15–29 data points</Copy>
        <Copy>Weak · 5–14 data points</Copy>
        <Copy>Insufficient · fewer than 5 data points</Copy>
        <Copy muted>
          Keep logging your metrics daily to improve reliability and discover
          more meaningful patterns.
        </Copy>
      </Sheet>
    </Panel>
  );
}
