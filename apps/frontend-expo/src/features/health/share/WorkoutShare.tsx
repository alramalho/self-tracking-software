import { useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { Check, Palette, RectangleHorizontal, RectangleVertical, Rows3, Share2 } from "lucide-react-native";
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
  ShareWatermarkProps,
} from "./types";
import type { RoutePoint } from "../workout-types";

function routePath(points: RoutePoint[], width: number, height: number, padding: number) {
  return shareRoutePoints(points, width, height, padding)
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function ShareWatermark({ mapOverlay = false, scale }: ShareWatermarkProps) {
  return (
    <View
      testID="workout-share-watermark"
      style={{
        position: "absolute",
        ...(mapOverlay ? { right: 8 * scale, bottom: 8 * scale } : { right: 20 * scale, bottom: 14 * scale }),
        flexDirection: "row",
        alignItems: "center",
        gap: 5 * scale,
        opacity: 0.6,
        zIndex: 2,
        elevation: 2,
      }}
    >
      <Image
        testID="workout-share-brand-mark"
        accessibilityLabel="Tracking logo"
        source={require("../../../../assets/icon.png")}
        resizeMode="contain"
        style={{ width: 15 * scale, height: 15 * scale, borderRadius: 4 * scale }}
      />
      <Text allowFontScaling={false} style={{ color: "#fff", fontSize: 10 * scale, fontWeight: "600", letterSpacing: 1.1 * scale, textShadowOffset: { width: 0, height: scale }, textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 2 * scale }}>
        tracking.so
      </Text>
    </View>
  );
}

export function WorkoutShareCard({ workout, options, captureRef, width }: WorkoutShareCardProps) {
  const stats = workoutShareStats(workout).slice(0, options.statsCount);
  const canvas = shareCanvasSize(options.statsCount, options.orientation);
  const scale = width / canvas.width;
  const size = { width, height: canvas.height * scale };
  const landscape = options.orientation === "landscape";
  const padding = (landscape ? 16 : 24) * scale;
  const gap = (landscape ? 10 : 16) * scale;
  const availableWidth = size.width - padding * 2 - gap;
  const routeWidth = landscape ? Math.floor(availableWidth * 0.56) : size.width - padding * 2;
  const landscapeContentHeight = (options.statsCount === 6 ? 160 : 124) * scale;
  const routeHeight = landscape ? landscapeContentHeight : 168 * scale;
  const routePadding = (landscape ? 24 : 22) * scale;
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
        padding,
        backgroundColor: "transparent",
        flexDirection: "column",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <View
        style={{
          ...(landscape
            ? {
                position: "absolute",
                left: padding,
                right: padding,
                top: (size.height - landscapeContentHeight) / 2,
                height: landscapeContentHeight,
              }
            : { flex: 1, width: "100%" }),
          flexDirection: landscape ? "row" : "column",
          justifyContent: "center",
          alignItems: landscape ? "center" : "stretch",
          gap,
        }}
      >
        <View
          testID="workout-share-route"
          style={{
            position: "relative",
            width: routeWidth,
            height: routeHeight,
          }}
        >
          <Svg width={routeWidth} height={routeHeight} viewBox={`0 0 ${routeWidth} ${routeHeight}`}>
            <Path d={line} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={8 * scale} strokeLinecap="round" strokeLinejoin="round" />
            <Path d={line} fill="none" stroke={color} strokeWidth={4 * scale} strokeLinecap="round" strokeLinejoin="round" />
            {start && <Circle testID="workout-share-route-start" cx={start.x} cy={start.y} r={7 * scale} fill="#fff" stroke={color} strokeWidth={4 * scale} />}
            {finish && <Circle testID="workout-share-route-finish" cx={finish.x} cy={finish.y} r={7 * scale} fill={color} stroke="#fff" strokeWidth={3 * scale} />}
          </Svg>
          {landscape && <ShareWatermark mapOverlay scale={scale} />}
        </View>
        <View
          style={{
            flex: landscape ? 1 : undefined,
            justifyContent: landscape ? "center" : undefined,
            alignSelf: landscape ? "stretch" : undefined,
          }}
        >
          <View
            testID="workout-share-stats"
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: landscape ? "space-between" : undefined,
              columnGap: (landscape ? 8 : 14) * scale,
              rowGap: (landscape ? 8 : 14) * scale,
            }}
          >
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={{
                  width: landscape ? (options.statsCount === 6 ? "47%" : "100%") : "30%",
                  gap: 2 * scale,
                }}
              >
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{
                    color: "rgba(255,255,255,0.82)",
                    fontSize: (landscape ? 8 : 9) * scale,
                    fontWeight: "600",
                    textTransform: "uppercase",
                    letterSpacing: 0.55 * scale,
                    textShadowOffset: { width: 0, height: scale }, textShadowColor: "rgba(0,0,0,0.9)",
                    textShadowRadius: 2 * scale,
                  }}
                >
                  {stat.label}
                </Text>
                <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={{ color: "#fff", fontSize: (landscape ? 15 : 19) * scale, fontWeight: "700", textShadowOffset: { width: 0, height: scale }, textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 2 * scale }}>
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      {!landscape && <ShareWatermark scale={scale} />}
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
  const [viewportWidth, setViewportWidth] = useState(0);
  const stats = useMemo(() => workoutShareStats(workout), [workout]);
  const title = `My ${workout.displayName.toLowerCase()}`;
  const previewSize = shareCanvasSize(options.statsCount, options.orientation);
  const previewWidth = Math.min(previewSize.width, viewportWidth);
  const previewHeight = previewSize.height * previewWidth / previewSize.width;

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
            onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
            style={{
              width: "100%",
              height: previewHeight + 20,
              paddingVertical: 10,
              borderRadius: 18,
              backgroundColor: c.dark ? "#292929" : "#e3e3e3",
              overflow: "hidden",
              alignItems: "center",
            }}
          >
            {previewWidth > 0 && (
              <WorkoutShareCard workout={workout} options={options} captureRef={view} width={previewWidth} />
            )}
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
        <Button testID="share-export-button" disabled={previewWidth <= 0} busy={sharing} onPress={() => void share()}>Share image</Button>
      </Sheet>
    </>
  );
}
