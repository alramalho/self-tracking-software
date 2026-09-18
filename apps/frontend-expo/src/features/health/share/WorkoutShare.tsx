import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Activity, Check, Palette, RectangleHorizontal, RectangleVertical, Rows3, Share2 } from "lucide-react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Button, Panel, Sheet, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { shareWorkoutCard } from "./capture";
import { paletteColor, SHARE_PALETTES, shareCanvasSize, shareRoutePoints, workoutShareStats } from "./model";
import type {
  ChoiceChipProps,
  ControlRowProps,
  WorkoutShareCardProps,
  WorkoutShareOptions,
  WorkoutShareProps,
  WorkoutShareStatsCount,
} from "./types";
import type { HealthWorkoutPreview, RoutePoint } from "../workout-types";

function routePath(points: RoutePoint[], width: number, height: number, padding: number) {
  return shareRoutePoints(points, width, height, padding)
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

export function WorkoutShareCard({ workout, options, captureRef }: WorkoutShareCardProps) {
  const stats = workoutShareStats(workout).slice(0, options.statsCount);
  const size = shareCanvasSize(options.statsCount, options.orientation);
  const landscape = options.orientation === "landscape";
  // Keep the route full-width in landscape. A narrow route column leaves too
  // little room for stat labels, which makes words wrap and pushes the last
  // row out of the captured canvas.
  const routeWidth = size.width - 48;
  const routeHeight = landscape ? 154 : 168;
  const routePadding = 22;
  const points = workout.route ?? [];
  const coordinates = shareRoutePoints(points, routeWidth, routeHeight, routePadding);
  const color = paletteColor(options.palette);
  const line = routePath(points, routeWidth, routeHeight, routePadding);
  const start = coordinates[0];
  const finish = coordinates[coordinates.length - 1];

  return (
    <View
      ref={captureRef}
      collapsable={false}
      testID="workout-share-preview"
      style={{
        width: size.width,
        height: size.height,
        padding: 24,
        backgroundColor: "transparent",
        gap: landscape ? 14 : 16,
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Svg width={routeWidth} height={routeHeight} viewBox={`0 0 ${routeWidth} ${routeHeight}`}>
        <Path d={line} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={line} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        {start && <Circle cx={start.x} cy={start.y} r={7} fill="#fff" stroke={color} strokeWidth={4} />}
        {finish && <Circle cx={finish.x} cy={finish.y} r={7} fill={color} stroke="#fff" strokeWidth={3} />}
      </Svg>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: landscape ? 12 : 14, rowGap: landscape ? 10 : 14 }}>
        {stats.map((stat) => (
          <View key={stat.label} style={{ width: "30%", gap: 2 }}>
            <Text
              style={{
                color: "rgba(255,255,255,0.82)",
                fontSize: landscape ? 9 : 10,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: landscape ? 0.55 : 0.7,
                textShadowColor: "rgba(0,0,0,0.72)",
                textShadowRadius: 4,
              }}
            >
              {stat.label}
            </Text>
            <Text style={{ color: "#fff", fontSize: landscape ? 17 : 19, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.72)", textShadowRadius: 5 }}>
              {stat.value}
            </Text>
          </View>
        ))}
      </View>
      <View
        testID="workout-share-watermark"
        style={{
          position: "absolute",
          right: 20,
          bottom: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          opacity: 0.48,
        }}
      >
        <Activity size={13} color="#fff" strokeWidth={2.2} />
        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600", letterSpacing: 1.1, textShadowColor: "rgba(0,0,0,0.72)", textShadowRadius: 4 }}>
          tracking.so
        </Text>
      </View>
    </View>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
  testID,
  swatch,
  icon: Icon,
}: ChoiceChipProps) {
  const c = useColors();
  const ChipIcon = Icon;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 13,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: selected ? c.selectedBorder : c.border,
        backgroundColor: selected ? c.selectedBg : c.card,
        opacity: pressed ? 0.72 : 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      })}
    >
      {swatch ? <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: swatch }} /> : ChipIcon ? <ChipIcon size={16} color={selected ? c.accent : c.muted} /> : null}
      <Text style={{ color: selected ? c.text : c.muted, fontSize: 13, fontWeight: selected ? "600" : "500" }}>{label}</Text>
      {selected && <Check size={15} color={c.accent} strokeWidth={2.5} />}
    </Pressable>
  );
}

function ControlRow({ title, icon: Icon, children }: ControlRowProps) {
  const c = useColors();
  return (
    <View style={{ gap: 9 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Icon size={16} color={c.muted} />
        <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>{title}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {children}
      </ScrollView>
    </View>
  );
}

export function WorkoutShare({ workout }: WorkoutShareProps) {
  const [visible, setVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string>();
  const [options, setOptions] = useState<WorkoutShareOptions>({ statsCount: 3, palette: "sunset", orientation: "portrait" });
  const view = useRef<View>(null);
  const c = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const stats = useMemo(() => workoutShareStats(workout), [workout]);
  const title = `My ${workout.displayName.toLowerCase()}`;
  const previewSize = shareCanvasSize(options.statsCount, options.orientation);
  const previewScale = Math.min(1, Math.max(0.1, (windowWidth - 72) / previewSize.width));

  const open = () => {
    setError(undefined);
    setVisible(true);
  };

  const share = async () => {
    setSharing(true);
    setError(undefined);
    try {
      await shareWorkoutCard({ view, title });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The share image could not be created.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <Panel testID="workout-share-entry" style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Share2 size={20} color={c.accent} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: c.text, fontWeight: "700" }}>Share this run</Text>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>Make a transparent route card for your story.</Text>
          </View>
        </View>
        <Button testID="share-workout-button" onPress={open}>Create share card</Button>
      </Panel>

      <Sheet visible={visible} title="Create share card" onClose={() => setVisible(false)}>
        <Panel testID="workout-share-editor" style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>Preview</Text>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Transparent PNG · adjust the route color, stats and format below.</Text>
          </View>
          <View
            testID="workout-share-viewport"
            style={{
              width: "100%",
              height: previewSize.height * previewScale + 20,
              paddingVertical: 10,
              borderRadius: 18,
              backgroundColor: c.dark ? "#292929" : "#e3e3e3",
              overflow: "hidden",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: previewSize.width,
                height: previewSize.height,
                transform: [{ scale: previewScale }],
              }}
            >
              <WorkoutShareCard workout={workout} options={options} captureRef={view} />
            </View>
          </View>
        </Panel>

        <ControlRow title="Route color" icon={Palette}>
          {SHARE_PALETTES.map((palette) => (
            <ChoiceChip
              key={palette.id}
              testID={`share-map-color-${palette.id}`}
              label={palette.label}
              swatch={palette.color}
              selected={options.palette === palette.id}
              onPress={() => setOptions((current) => ({ ...current, palette: palette.id }))}
            />
          ))}
        </ControlRow>

        <ControlRow title="Stats" icon={Rows3}>
          {[3, 6].map((count) => (
            <ChoiceChip
              key={count}
              testID={`share-stats-count-${count}`}
              label={`${Math.min(count, stats.length)} stats`}
              selected={options.statsCount === count}
              onPress={() => setOptions((current) => ({ ...current, statsCount: count as WorkoutShareStatsCount }))}
            />
          ))}
        </ControlRow>

        <ControlRow title="Format" icon={RectangleHorizontal}>
          <ChoiceChip
            testID="share-orientation-portrait"
            label="Portrait"
            icon={RectangleVertical}
            selected={options.orientation === "portrait"}
            onPress={() => setOptions((current) => ({ ...current, orientation: "portrait" }))}
          />
          <ChoiceChip
            testID="share-orientation-landscape"
            label="Landscape"
            icon={RectangleHorizontal}
            selected={options.orientation === "landscape"}
            onPress={() => setOptions((current) => ({ ...current, orientation: "landscape" }))}
          />
        </ControlRow>

        {error && <Text accessibilityRole="alert" style={{ color: c.dark ? "#f87171" : "#dc2626", lineHeight: 18 }}>{error}</Text>}
        <Button testID="share-export-button" busy={sharing} onPress={() => void share()}>Share image</Button>
      </Sheet>
    </>
  );
}
