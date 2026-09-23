import { View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { Text } from "@/components/typography/Text";
import { Panel, useColors } from "@/components/ui";
import { buildHeartRateChart, CHART_HEIGHT, CHART_PADDING, CHART_WIDTH, workoutElapsedSpan, zoneForBpm } from "./model";
import type { HeartRateChartProps, HeartRateChartSegment, HeartRateZone } from "./types";

const ZONE_COLORS: Record<HeartRateZone, string> = {
  1: "#60a5fa",
  2: "#34d399",
  3: "#facc15",
  4: "#fb923c",
  5: "#f87171",
};

function elapsedLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function segmentPath(segment: HeartRateChartSegment) {
  return `M ${segment.from.x.toFixed(2)} ${segment.from.y.toFixed(2)} L ${segment.to.x.toFixed(2)} ${segment.to.y.toFixed(2)}`;
}

function segmentFill(segment: HeartRateChartSegment) {
  const baseline = CHART_HEIGHT - CHART_PADDING;
  return `${segmentPath(segment)} L ${segment.to.x.toFixed(2)} ${baseline} L ${segment.from.x.toFixed(2)} ${baseline} Z`;
}

export function HeartRateChart({ points, startAt, endAt, zones, age, averageBpm }: HeartRateChartProps) {
  const c = useColors();
  const elapsedSpanSeconds = workoutElapsedSpan(startAt, endAt);
  const model = elapsedSpanSeconds == null ? null : buildHeartRateChart(points, elapsedSpanSeconds, zones, age);
  if (!model) {
    return (
      <Panel testID="heart-rate-chart-unavailable" style={{ gap: 4 }}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>Heart rate</Text>
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
          {averageBpm == null
            ? "No usable timestamped heart-rate readings are available for this workout."
            : "This source supplied a heart-rate summary without timestamped readings to plot."}
        </Text>
      </Panel>
    );
  }

  const neutralColor = c.dark ? "#b7c0d0" : "#64748b";
  const sourceLabel = model.zoneSource === "workout_age_estimate"
    ? "Estimated zones from workout age"
    : model.zoneSource === "profile_age"
      ? "Estimated zones from current profile age"
      : "Zones unavailable without your age";
  const accessibilityLabel = [
    `Heart rate graph, ${model.points.length} recorded samples over ${elapsedLabel(model.elapsedSpanSeconds)} elapsed, ${Math.min(...model.points.map((point) => point.bpm))} to ${Math.max(...model.points.map((point) => point.bpm))} beats per minute.`,
    model.maximumForZones == null
      ? "Zone thresholds are unavailable."
      : `Five estimated zones based on ${Math.round(model.maximumForZones)} beats per minute maximum.`,
    model.hasGaps ? "Missing sample periods are shown as gaps." : "",
  ].filter(Boolean).join(" ");

  return (
    <Panel testID="heart-rate-chart" style={{ gap: 12 }}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>Heart rate</Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>{sourceLabel}{model.maximumForZones == null ? "" : ` · ${Math.round(model.maximumForZones)} bpm max`}</Text>
      </View>
      <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} testID="heart-rate-chart-plot">
        <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
          <Defs>
            {([1, 2, 3, 4, 5] as HeartRateZone[]).map((zone) => (
              <LinearGradient id={`heart-zone-${zone}`} key={zone} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ZONE_COLORS[zone]} stopOpacity={c.dark ? "0.21" : "0.16"} />
                <Stop offset="1" stopColor={ZONE_COLORS[zone]} stopOpacity="0.015" />
              </LinearGradient>
            ))}
          </Defs>
          {[0, 0.5, 1].map((fraction) => {
            const y = CHART_PADDING + fraction * (CHART_HEIGHT - CHART_PADDING * 2);
            return <Line key={fraction} x1={CHART_PADDING} x2={CHART_WIDTH - CHART_PADDING} y1={y} y2={y} stroke={c.border} strokeWidth={1} opacity={0.65} />;
          })}
          {model.segments.map((segment, index) => {
            const color = segment.zone == null ? neutralColor : ZONE_COLORS[segment.zone];
            return (
              <G key={index}>
                {segment.zone != null && <Path d={segmentFill(segment)} fill={`url(#heart-zone-${segment.zone})`} />}
                <Path
                  d={segmentPath(segment)}
                  fill="none"
                  stroke={color}
                  strokeWidth={3}
                  strokeOpacity={c.dark ? 0.9 : 0.86}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  testID={`heart-rate-segment-${segment.zone ?? "unknown"}`}
                />
              </G>
            );
          })}
          {model.points.map((point, index) => (
            <Circle key={index} cx={point.x} cy={point.y} r={2.1} fill={model.maximumForZones == null ? neutralColor : ZONE_COLORS[zoneForBpm(point.bpm, model.maximumForZones)]} opacity={0.9} />
          ))}
        </Svg>
        <View style={{ position: "absolute", top: 0, right: 0, height: CHART_HEIGHT, justifyContent: "space-between", paddingVertical: 7 }} pointerEvents="none">
          <Text style={{ color: c.muted, fontSize: 11 }}>{model.maximumBpm}</Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{model.minimumBpm}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 }}>
        <Text style={{ color: c.muted, fontSize: 11 }}>0m</Text>
        <Text style={{ color: c.muted, fontSize: 11 }}>{elapsedLabel(model.elapsedSpanSeconds / 2)}</Text>
        <Text style={{ color: c.muted, fontSize: 11 }}>{elapsedLabel(model.elapsedSpanSeconds)}</Text>
      </View>
      {model.maximumForZones != null && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 3 }}>
          {([1, 2, 3, 4, 5] as HeartRateZone[]).map((zone) => (
            <View key={zone} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
              <View style={{ height: 7, width: 7, borderRadius: 4, backgroundColor: ZONE_COLORS[zone] }} />
              <Text style={{ color: c.muted, fontSize: 11 }}>Z{zone}</Text>
            </View>
          ))}
        </View>
      )}
      {averageBpm != null && Number.isFinite(averageBpm) && (
        <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>{Math.round(averageBpm)} bpm average</Text>
      )}
      <Text style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>
        {model.maximumForZones == null
          ? "Heart rate is recorded; add your age in Profile to estimate zones."
          : "Zone colors estimate 60%, 70%, 80% and 90% of maximum heart rate. Transitions between readings are interpolated."}
        {model.hasGaps ? " Breaks indicate missing readings." : ""}
      </Text>
    </Panel>
  );
}
