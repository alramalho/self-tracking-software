import { View } from "react-native";
import Svg, { ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { Text } from "@/components/typography/Text";
import { Panel, useColors } from "@/components/ui";
import { zoneStrokeStops } from "./gradient";
import { buildHeartRateChart, CHART_HEIGHT, CHART_PADDING, CHART_WIDTH, workoutElapsedSpan } from "./model";
import { smoothAreaPath, smoothRunPath } from "./path";
import type { HeartRateChartProps, HeartRateZone } from "./types";

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
  const strokeStops = zoneStrokeStops(model.segments);
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
            <ClipPath id="heart-rate-area">
              {model.runs.map((run, index) => <Path key={index} d={smoothAreaPath(run, CHART_HEIGHT - CHART_PADDING)} />)}
            </ClipPath>
            <LinearGradient id="heart-rate-stroke" x1={CHART_PADDING} y1="0" x2={CHART_WIDTH - CHART_PADDING} y2="0" gradientUnits="userSpaceOnUse">
              {strokeStops.map((stop, index) => <Stop key={index} offset={stop.offset} stopColor={ZONE_COLORS[stop.zone]} />)}
            </LinearGradient>
            {([1, 2, 3, 4, 5] as HeartRateZone[]).map((zone) => (
              <LinearGradient id={`heart-zone-${zone}`} key={zone} x1="0" y1={CHART_PADDING} x2="0" y2={CHART_HEIGHT - CHART_PADDING} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={ZONE_COLORS[zone]} stopOpacity={c.dark ? "0.36" : "0.28"} />
                <Stop offset="0.7" stopColor={ZONE_COLORS[zone]} stopOpacity={c.dark ? "0.20" : "0.15"} />
                <Stop offset="1" stopColor={ZONE_COLORS[zone]} stopOpacity="0.015" />
              </LinearGradient>
            ))}
          </Defs>
          {[0, 0.5, 1].map((fraction) => {
            const y = CHART_PADDING + fraction * (CHART_HEIGHT - CHART_PADDING * 2);
            return <Line key={fraction} x1={CHART_PADDING} x2={CHART_WIDTH - CHART_PADDING} y1={y} y2={y} stroke={c.border} strokeWidth={1} opacity={0.65} />;
          })}
          <G clipPath="url(#heart-rate-area)">
            {model.segments.map((segment, index) => segment.zone == null ? null : (
              <Rect key={index} x={segment.from.x} y={0} width={segment.to.x - segment.from.x} height={CHART_HEIGHT} fill={`url(#heart-zone-${segment.zone})`} />
            ))}
          </G>
          {model.runs.map((run, index) => <Path
            key={index}
            d={smoothRunPath(run)}
            fill="none"
            stroke={model.maximumForZones == null ? neutralColor : "url(#heart-rate-stroke)"}
            strokeWidth={2.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            testID="heart-rate-line"
          />)}
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
