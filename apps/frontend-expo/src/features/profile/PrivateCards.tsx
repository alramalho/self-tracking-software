import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { formatDistanceToNowStrict, subDays } from "date-fns";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { dayKey } from "@/core/dates";
import { useMetricEntries, useMetrics } from "@/data/queries";
import { useHealth } from "@/features/health/HealthProvider";
import { useHealthDailyMetrics, useSleepScores } from "@/features/health/queries";
import { formatVitalValue, latestRecord } from "@/features/health/daily-model";
import { dailyRatings, metricSummary } from "@/features/metrics/model";
import type { PrivateCardProps, SparklineProps } from "./types";

function PrivateCard({ emoji, title, subtitle, onPress, children, testID }: PrivateCardProps) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => ({ padding: 16, borderRadius: 20, backgroundColor: c.card, gap: 12, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{title}</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>{subtitle}</Text>
        </View>
        <ChevronRight size={18} color={c.muted} />
      </View>
      {children}
    </Pressable>
  );
}

/** Daily ratings on the 1–5 scale, oldest to newest, with the latest point marked. */
function Sparkline({ values }: SparklineProps) {
  const c = useColors();
  const w = 300, h = 44;
  if (values.length < 2) return null;
  const xy = values.map((v, i) => [(i / (values.length - 1)) * (w - 8) + 4, h - 4 - ((v - 1) / 4) * (h - 8)]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <Path d={`${line} L${lx.toFixed(1)} ${h} L${xy[0][0].toFixed(1)} ${h} Z`} fill={`${c.accent}26`} />
      <Path d={line} fill="none" stroke={c.accent} strokeWidth={2} />
      <Circle cx={lx} cy={ly} r={3.5} fill={c.accent} />
    </Svg>
  );
}

/** Your own check-ins: this week's average against last week's, and the last ten days. */
export function CheckinsCard() {
  const metrics = useMetrics();
  const entries = useMetricEntries();
  const metric = metrics.data?.[0];
  const mine = (entries.data ?? []).filter((e) => e.metricId === metric?.id);
  const summary = metricSummary(mine);
  const ratings = dailyRatings(mine);
  const days = Array.from({ length: 10 }, (_, i) => dayKey(subDays(new Date(), 9 - i)));
  const values = days.map((d) => ratings.get(d)).filter((v): v is number => v !== undefined);
  const now = summary.currentAverage;
  const before = summary.previousAverage;
  const subtitle = !metric
    ? "Track how you feel each day"
    : now === null
      ? `No ${metric.title.toLowerCase()} check-ins this week`
      : `${metric.title} ${now.toFixed(1)} avg this week${before !== null && Math.abs(now - before) >= 0.1 ? ` · ${now > before ? "up" : "down"} from ${before.toFixed(1)}` : ""}`;
  return (
    <PrivateCard testID="profile-checkins" emoji={metric?.emoji ?? "⚡"} title="Check-ins" subtitle={subtitle} onPress={() => router.push("/metrics")}>
      <Sparkline values={values} />
    </PrivateCard>
  );
}

/** What your watch or Health app syncs, at a glance. */
export function HealthCard() {
  const c = useColors();
  const health = useHealth();
  const vitals = useHealthDailyMetrics();
  const sleep = useSleepScores();
  const apple = health.status?.connected;
  const garmin = health.garmin.status?.connected;
  const synced = health.status?.lastSyncCompletedAt ?? health.garmin.status?.lastSyncCompletedAt;
  const lastNight = sleep.data?.scores[0];
  const resting = latestRecord(vitals.data?.metrics ?? [], "resting_heart_rate");
  const facts = [
    lastNight ? `Sleep ${Math.floor(lastNight.asleepMinutes / 60)} h ${String(lastNight.asleepMinutes % 60).padStart(2, "0")}` : null,
    resting ? `Resting HR ${formatVitalValue(resting).replace(" bpm", "")}` : null,
  ].filter(Boolean);
  const subtitle = !apple && !garmin
    ? "Connect Apple Health or Garmin"
    : `${apple ? "Apple Health" : "Garmin"}${synced ? ` · synced ${formatDistanceToNowStrict(new Date(synced), { addSuffix: true })}` : ""}`;
  return (
    <PrivateCard testID="profile-health" emoji="⌚" title="Health" subtitle={subtitle} onPress={() => router.push("/health")}>
      {facts.length > 0 && (
        <View style={{ flexDirection: "row", gap: 18 }}>
          {facts.map((fact) => (
            <Text key={fact} style={{ color: c.muted, fontSize: 14 }}>
              {fact}
            </Text>
          ))}
        </View>
      )}
    </PrivateCard>
  );
}
