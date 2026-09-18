import { Platform, View } from "react-native";
import { Activity, Clock3, Flame, Gauge, HeartPulse, Lock, Mountain, Ruler, Timer, Users } from "lucide-react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { Text } from "@/components/typography/Text";
import { Panel, useColors } from "@/components/ui";
import { TrackingMap } from "@/native/TrackingMap";
import type {
  ElevationProfilePoint,
  HealthWorkoutPreview,
  HeartRateSeriesPoint,
  HeartRateZones,
  ResolvedWorkoutReconciliation,
  RoutePoint,
} from "./workout-types";

interface VitalProps {
  label: string;
  value: string;
  icon: typeof Activity;
  color?: string;
}

function Vital({ label, value, icon: Icon, color }: VitalProps) {
  const c = useColors();
  return (
    <View style={{ width: "47%", gap: 7, paddingVertical: 8 }}>
      <Icon size={18} color={color ?? c.muted} strokeWidth={1.7} />
      <Text style={{ color: c.text, fontSize: 21, fontWeight: "600" }}>{value}</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function duration(value: number) {
  const minutes = Math.round(value / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function pace(workout: HealthWorkoutPreview) {
  if (!workout.distanceMeters || workout.distanceMeters < 100) return null;
  const secondsPerKm = workout.durationSeconds / (workout.distanceMeters / 1000);
  const roundedSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(roundedSeconds / 60);
  return `${minutes}:${String(roundedSeconds % 60).padStart(2, "0")} /km`;
}

function isRunning(workout: HealthWorkoutPreview) {
  return /(^|[_\s-])run(ning)?([_\s-]|$)/i.test(workout.activityTypeName);
}

function zoneDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function HeartRateChart({ points, averageBpm }: { points: HeartRateSeriesPoint[]; averageBpm?: number | null }) {
  const c = useColors();
  const width = 320;
  const height = 158;
  const padding = 18;
  const values = points.map((point) => point.bpm);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(maximum - minimum, 1);
  const elapsedRange = Math.max(points[points.length - 1].elapsedSeconds, 1);
  const coordinates = points.map((point) => ({
    x: padding + (point.elapsedSeconds / elapsedRange) * (width - padding * 2),
    y: height - padding - ((point.bpm - minimum) / range) * (height - padding * 2),
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const average = Math.round(averageBpm ?? values.reduce((total, value) => total + value, 0) / values.length);
  const timeLabel = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
  };

  return (
    <Panel testID="heart-rate-chart" style={{ gap: 8 }}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>Heart rate</Text>
      <View accessibilityLabel="Heart rate chart">
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {[0.25, 0.5, 0.75].map((ratio) => (
            <Line
              key={ratio}
              x1={padding}
              x2={width - padding}
              y1={padding + ratio * (height - padding * 2)}
              y2={padding + ratio * (height - padding * 2)}
              stroke={c.border}
              strokeWidth={1}
              opacity={0.55}
            />
          ))}
          <Path d={linePath} fill="none" stroke="#ff553d" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <View style={{ position: "absolute", top: 0, right: 0, gap: 58, alignItems: "flex-end" }}>
          <Text style={{ color: c.muted, fontSize: 11 }}>{Math.round(maximum)}</Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{Math.round(minimum)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, marginTop: -5 }}>
          <Text style={{ color: c.muted, fontSize: 11 }}>{timeLabel(points[0].elapsedSeconds)}</Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{timeLabel(elapsedRange / 2)}</Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{timeLabel(elapsedRange)}</Text>
        </View>
      </View>
      <Text style={{ color: "#ff553d", fontSize: 12, fontWeight: "700" }}>{average} BPM AVG</Text>
    </Panel>
  );
}

function RouteMap({ points }: { points: RoutePoint[] }) {
  const c = useColors();
  const width = 320;
  const height = 176;
  const padding = 24;
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.00001);
  const lonRange = Math.max(maxLon - minLon, 0.00001);
  const coordinates = points.map((point) => ({
    x: padding + ((point.longitude - minLon) / lonRange) * (width - padding * 2),
    y: height - padding - ((point.latitude - minLat) / latRange) * (height - padding * 2),
  }));
  const routePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];
  const mapBackground = c.dark ? "#0e3c45" : "#dcebe7";
  const mapRoad = c.dark ? "#28545d" : "#c7d8d5";
  return (
    <Panel testID="workout-route-map" style={{ gap: 8 }}>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>Map</Text>
      {Platform.OS === "ios" ? (
        <TrackingMap
          accessibilityLabel="Workout route map"
          dark={c.dark}
          routeJSON={JSON.stringify(points)}
          style={{ height, borderRadius: 16, overflow: "hidden" }}
        />
      ) : (
        <View accessibilityLabel="Workout route map" style={{ overflow: "hidden", borderRadius: 16, backgroundColor: mapBackground }}>
          <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            <Rect x="0" y="0" width={width} height={height} fill={mapBackground} />
            <G opacity={0.62}>
              <Path d={`M -10 30 C 60 80, 95 15, 185 68 S 285 80, 335 28`} fill="none" stroke={mapRoad} strokeWidth={2} />
              <Path d={`M 20 185 C 80 110, 125 155, 170 82 S 260 42, 325 100`} fill="none" stroke={mapRoad} strokeWidth={2} />
              <Path d={`M 80 -10 C 115 45, 175 30, 210 190`} fill="none" stroke={mapRoad} strokeWidth={1.5} />
              <Path d={`M 260 -10 C 230 46, 275 105, 235 186`} fill="none" stroke={mapRoad} strokeWidth={1.5} />
            </G>
            <Path d={routePath} fill="none" stroke="#ffd21f" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={start.x} cy={start.y} r={6} fill="#ff8b3d" stroke="#fff" strokeWidth={2} />
            <Circle cx={end.x} cy={end.y} r={7} fill="#62e58a" stroke="#fff" strokeWidth={2} />
          </Svg>
        </View>
      )}
      <Text style={{ color: c.muted, fontSize: 12 }}>
        Apple Watch route · {Math.round(points[points.length - 1].distanceMeters / 100) / 10} km
      </Text>
    </Panel>
  );
}

function ElevationProfile({ points }: { points: ElevationProfilePoint[] }) {
  const c = useColors();
  const elevationColor = "#56d364";
  const width = 320;
  const height = 150;
  const padding = 12;
  const elevations = points.map((point) => point.elevationMeters);
  const minimum = Math.min(...elevations);
  const maximum = Math.max(...elevations);
  const elevationRange = Math.max(maximum - minimum, 1);
  const distanceRange = Math.max(points[points.length - 1].distanceMeters, 1);
  const coordinates = points.map((point) => ({
    x: padding + (point.distanceMeters / distanceRange) * (width - padding * 2),
    y: height - padding - ((point.elevationMeters - minimum) / elevationRange) * (height - padding * 2),
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const areaPath = `${linePath} L ${last.x.toFixed(2)} ${(height - padding).toFixed(2)} L ${first.x.toFixed(2)} ${(height - padding).toFixed(2)} Z`;

  return (
    <Panel testID="elevation-profile" style={{ gap: 10 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>
          Elevation profile
        </Text>
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
          Altitude over the route · {Math.round(points[points.length - 1].distanceMeters / 1000 * 10) / 10} km
        </Text>
      </View>
      <View accessibilityLabel="Elevation profile chart">
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <LinearGradient id="elevation-profile-fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={elevationColor} stopOpacity="0.42" />
              <Stop offset="1" stopColor={elevationColor} stopOpacity="0.04" />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#elevation-profile-fill)" />
          <Path d={linePath} fill="none" stroke={elevationColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: c.muted, fontSize: 11 }}>{Math.round(minimum)} m</Text>
        <Text style={{ color: c.muted, fontSize: 11 }}>{Math.round(maximum)} m</Text>
      </View>
    </Panel>
  );
}

function HeartRateZones({ zones }: { zones: HeartRateZones }) {
  const c = useColors();
  const values = [
    zones.zone1Seconds,
    zones.zone2Seconds,
    zones.zone3Seconds,
    zones.zone4Seconds,
    zones.zone5Seconds,
  ];
  const maximum = Math.max(...values, 1);
  const colors = ["#60a5fa", "#34d399", "#facc15", "#fb923c", "#f87171"];
  return (
    <Panel testID="heart-rate-zones" style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>
          Heart-rate zones
        </Text>
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
          Time in each zone · estimated max {Math.round(zones.estimatedMaxHeartRateBpm)} bpm
        </Text>
      </View>
      <View style={{ height: 142, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        {values.map((seconds, index) => (
          <View key={index} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={{ width: "100%", height: 100, justifyContent: "flex-end", alignItems: "center" }}>
              <View
                style={{
                  width: "72%",
                  height: seconds > 0 ? `${Math.max(5, (seconds / maximum) * 100)}%` : 0,
                  borderRadius: 7,
                  backgroundColor: colors[index],
                }}
              />
            </View>
            <Text style={{ color: c.muted, fontSize: 11 }}>Z{index + 1}</Text>
            <Text style={{ color: c.text, fontSize: 11, fontWeight: "600" }}>{zoneDuration(seconds)}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>
        {zones.source === "age_estimate"
          ? "Zones use the standard 220-minus-age max-heart-rate estimate."
          : "Zones use a general 200 bpm max-heart-rate estimate until a personal value is available."}
      </Text>
    </Panel>
  );
}

export function WorkoutVitals({ workout, resolved }: { workout: HealthWorkoutPreview; resolved?: ResolvedWorkoutReconciliation | null }) {
  const c = useColors();
  const isPublic = resolved?.healthDataIsPublic ?? false;
  const linked = resolved?.linkedActivity;
  const running = isRunning(workout);
  const values: VitalProps[] = [
    { label: "Duration", value: duration(workout.durationSeconds), icon: Clock3, color: "#a78bfa" },
    ...(workout.distanceMeters == null
      ? []
      : [{ label: "Distance", value: `${(workout.distanceMeters / 1000).toFixed(2)} km`, icon: Ruler, color: "#38bdf8" }]),
    ...(pace(workout) ? [{ label: "Average pace", value: pace(workout)!, icon: Timer, color: "#c084fc" }] : []),
    ...(workout.activeEnergyKcal == null
      ? []
      : [{ label: "Active calories", value: `${Math.round(workout.activeEnergyKcal)} kcal`, icon: Flame, color: "#fb923c" }]),
    ...(workout.averageHeartRateBpm == null
      ? []
      : [{ label: "Average heart rate", value: `${Math.round(workout.averageHeartRateBpm)} bpm`, icon: HeartPulse, color: "#ff553d" }]),
    ...(workout.maximumHeartRateBpm == null
      ? []
      : [{ label: "Maximum heart rate", value: `${Math.round(workout.maximumHeartRateBpm)} bpm`, icon: HeartPulse, color: "#ff553d" }]),
    ...(running && workout.elevationAscendedMeters != null
      ? [{ label: "Elevation gain", value: `${Math.round(workout.elevationAscendedMeters)} m`, icon: Mountain, color: "#56d364" }]
      : []),
    ...(running && workout.elevationDescendedMeters != null
      ? [{ label: "Elevation loss", value: `${Math.round(workout.elevationDescendedMeters)} m`, icon: Mountain, color: "#22c55e" }]
      : []),
    ...(workout.effortScore == null
      ? []
      : [{ label: workout.effortSource === "user" ? "Your effort" : "Watch effort", value: `${workout.effortScore.toFixed(1)} / 10`, icon: Gauge, color: "#facc15" }]),
  ];
  return (
    <>
      <Panel style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Activity size={22} color="#facc15" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>
              {linked ? `${linked.emoji} ${linked.title}` : workout.displayName}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
              {linked ? `${linked.quantity} ${linked.measure} · Apple Watch ${workout.displayName.toLowerCase()} · ` : ""}
              {new Date(workout.startAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </Text>
          </View>
        </View>
      </Panel>
      <Panel style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 4 }}>
        {values.map((v) => <Vital key={v.label} {...v} />)}
      </Panel>
      {running && workout.elevationProfile && workout.elevationProfile.length >= 2 && (
        <ElevationProfile points={workout.elevationProfile} />
      )}
      {running && workout.heartRateSeries && workout.heartRateSeries.length >= 2 && (
        <HeartRateChart points={workout.heartRateSeries} averageBpm={workout.averageHeartRateBpm} />
      )}
      {running && workout.route && workout.route.length >= 2 && (
        <RouteMap points={workout.route} />
      )}
      <Panel style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        {isPublic ? <Users size={19} color={c.muted} /> : <Lock size={19} color={c.muted} />}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: c.text, fontWeight: "600" }}>{isPublic ? "Shared with activity" : "Private Watch data"}</Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>
            {isPublic
              ? "People who can see this activity can also see its Watch summary."
              : "Only you can see these vitals unless you explicitly share them while linking the workout."}
          </Text>
        </View>
      </Panel>
      {running && workout.heartRateZones && <HeartRateZones zones={workout.heartRateZones} />}
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
        {workout.deviceName ?? workout.sourceName ?? "Apple Health"} · {new Date(workout.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{new Date(workout.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </Text>
    </>
  );
}
