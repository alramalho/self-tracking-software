import { memo, useMemo, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { StoryPanel, StoryText, useStoryColors } from "../ui";
import { countries, flag, yearEntries } from "../model";
import paths from "../../../../assets/wrapped/world-paths.json";
import type { MapPathsProps, StoryProps } from "../types";
const MapPaths = memo(function MapPaths({
  countries,
  selected,
  onSelect,
}: MapPathsProps) {
  const c = useStoryColors();
  const max = Math.max(1, ...countries.map((v) => v.count));
  return (
    <>
      {paths.map((p, index) => {
        const value = countries.find((v) => v.code === p.code);
        return (
          <Path
            key={p.id ?? `region-${index}`}
            d={p.path ?? ""}
            fill={value ? c.accent : c.dark ? "#374151" : "#e5e7eb"}
            fillOpacity={value ? 0.35 + (0.65 * value.count) / max : 1}
            stroke={
              selected && selected === p.code
                ? c.text
                : c.dark
                  ? "#1f2937"
                  : "#ffffff"
            }
            strokeWidth={selected && selected === p.code ? 2 : 0.5}
            {...(Platform.OS === "web"
              ? { onClick: () => value && onSelect(p.code) }
              : { onPress: () => value && onSelect(p.code) })}
          />
        );
      })}
    </>
  );
});
export function World({ data }: StoryProps) {
  const values = useMemo(
    () => countries(yearEntries(data.entries, data.year)),
    [data],
  );
  const c = useStoryColors();
  const [selected, setSelected] = useState<string>();
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(300);
  const [base, setBase] = useState({ zoom: 1, x: 0, y: 0 });
  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onBegin(() => setBase({ zoom, x: origin.x, y: origin.y }))
    .onUpdate((e) => {
      const bound = 400 * (zoom - 1);
      setOrigin({
        x: Math.max(
          -bound,
          Math.min(bound, base.x + (e.translationX * 800) / size),
        ),
        y: Math.max(
          -bound,
          Math.min(bound, base.y + (e.translationY * 800) / size),
        ),
      });
    })
    .runOnJS(true);
  const pinch = Gesture.Pinch()
    .onBegin(() => setBase({ zoom, x: origin.x, y: origin.y }))
    .onUpdate((e) => setZoom(Math.max(1, Math.min(8, base.zoom * e.scale))))
    .runOnJS(true);
  const selectedCountry = values.find((v) => v.code === selected);
  return (
    <>
      <View style={{ gap: 8 }}>
        <StoryText title>Your World</StoryText>
        <StoryText muted>Where you tracked activities in {data.year}</StoryText>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <StoryPanel>
          <StoryText size={24}>
            {values.length}{" "}
            <StoryText muted>
              {values.length === 1 ? "country" : "countries"}
            </StoryText>
          </StoryText>
        </StoryPanel>
        <StoryPanel>
          <StoryText>
            {values.reduce((s, v) => s + v.count, 0)} entries
          </StoryText>
        </StoryPanel>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {values.map((v) => (
          <Pressable
            key={v.code}
            accessibilityRole="button"
            accessibilityLabel={`Explore ${v.name}`}
            onPress={() => setSelected(v.code)}
            style={{
              minWidth: 40,
              minHeight: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <StoryText size={26}>{flag(v.code)}</StoryText>
          </Pressable>
        ))}
      </View>
      <GestureDetector gesture={Gesture.Simultaneous(pan, pinch)}>
        <View
          testID="wrapped-map"
          onLayout={(e) => setSize(e.nativeEvent.layout.width)}
          style={{
            height: 310,
            borderRadius: 16,
            backgroundColor: c.soft,
            overflow: "hidden",
          }}
        >
          <Svg width="100%" height="100%" viewBox="0 0 800 600">
            <G
              transform={`translate(${400 + origin.x} ${300 + origin.y}) scale(${zoom}) translate(-400 -300)`}
            >
              <MapPaths
                countries={values}
                selected={selected}
                onSelect={setSelected}
              />
            </G>
          </Svg>
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 10, right: 10 }}
          >
            <StoryText muted size={11}>
              Pinch to zoom
            </StoryText>
          </View>
          {selectedCountry && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: 12,
                alignSelf: "center",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "#000000cc",
              }}
            >
              <StoryText style={{ color: "white", textAlign: "center" }}>
                {selectedCountry.name}
              </StoryText>
              <StoryText size={12} style={{ color: "#ffffffb3" }}>
                {selectedCountry.count} activities
              </StoryText>
            </View>
          )}
        </View>
      </GestureDetector>
      {zoom !== 1 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setZoom(1);
            setOrigin({ x: 0, y: 0 });
          }}
        >
          <StoryText>Reset map</StoryText>
        </Pressable>
      )}
      <StoryPanel>
        <StoryText muted>Top locations</StoryText>
        {values.length ? (
          values.slice(0, 5).map((v, i) => (
            <View
              key={v.code}
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <StoryText>
                {i + 1}. {v.name}
              </StoryText>
              <StoryText muted>
                {v.count} {v.count === 1 ? "entry" : "entries"}
              </StoryText>
            </View>
          ))
        ) : (
          <StoryText muted>
            No activity locations recorded for {data.year}.
          </StoryText>
        )}
      </StoryPanel>
    </>
  );
}
