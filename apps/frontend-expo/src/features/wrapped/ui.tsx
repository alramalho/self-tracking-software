import { StoryReveal } from "./Motion";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import type {
  PodiumProps,
  StatsProps,
  StoryFrameProps,
  StoryPanelProps,
  StoryTextProps,
} from "./types";
export function useStoryColors() {
  const c = useColors();
  return {
    ...c,
    bg: c.dark ? "#0a0a0a" : "#ffffff",
    text: c.dark ? "#ffffff" : "#171717",
    muted: c.dark ? "#ffffff80" : "#737373",
    soft: c.dark ? "#ffffff0d" : "#f5f5f5",
  };
}
export function StoryText({
  muted,
  size = 14,
  title,
  style,
  ...props
}: StoryTextProps) {
  const c = useStoryColors();
  return (
    <Text
      {...props}
      style={[
        {
          color: muted ? c.muted : c.text,
          fontSize: title ? 30 : size,
          ...(title
            ? {
                fontFamily: "ZalandoExpanded-Italic",
                fontWeight: "normal" as const,
              }
            : {}),
        },
        style,
      ]}
    />
  );
}
export function StoryFrame({
  children,
  accent = "#8b5cf6",
  center,
  captureRef,
}: StoryFrameProps) {
  const c = useStoryColors();
  const { height } = useWindowDimensions();
  return (
    <View
      ref={captureRef}
      collapsable={false}
      style={{
        minHeight: height - 140,
        backgroundColor: c.bg,
        flexGrow: 1,
        padding: 24,
        paddingTop: 20,
        paddingBottom: 32,
        justifyContent: center ? "center" : undefined,
        gap: 20,
      }}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern
              id="dots"
              width={24}
              height={24}
              patternUnits="userSpaceOnUse"
            >
              <Circle cx={2} cy={2} r={1} fill={c.text} opacity={0.04} />
            </Pattern>
            <RadialGradient id="story-glow" cx="80%" cy="20%" rx="75%" ry="50%">
              <Stop
                offset="0"
                stopColor={accent}
                stopOpacity={c.dark ? 0.12 : 0.18}
              />
              <Stop offset="1" stopColor={accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#dots)" />
          <Rect width="100%" height="100%" fill="url(#story-glow)" />
        </Svg>
      </View>
      {children}
    </View>
  );
}
export function StoryPanel({ children, style }: StoryPanelProps) {
  const c = useStoryColors();
  return (
    <View
      style={[
        { padding: 16, borderRadius: 16, backgroundColor: c.soft, gap: 12 },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Stats({ items }: StatsProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        justifyContent: "center",
        width: "100%",
      }}
    >
      {items.map((item) => (
        <View
          key={item.label}
          style={{ flex: 1, alignItems: "center", gap: 4 }}
        >
          <StoryText
            size={32}
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
              fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            }}
          >
            {item.value}
          </StoryText>
          <StoryText muted size={11}>
            {item.label}
          </StoryText>
        </View>
      ))}
    </View>
  );
}
export function Podium({ items, onPress }: PodiumProps) {
  const top = items.slice(0, 3),
    display = top.length >= 2 ? [top[1], top[0], ...top.slice(2)] : top;
  const c = useStoryColors();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: 12,
        marginTop: 16,
        marginBottom: 8,
      }}
    >
      {display.map((item, index) => {
        const rank = top.indexOf(item);
        const color = item.color ?? (rank === 0 ? "#f59e0b" : c.muted);
        return (
          <StoryReveal
            key={item.id}
            height={[128, 96, 72][rank]}
            delay={400 + index * 150}
            style={{ width: "28%", maxWidth: 96 }}
          >
            <Pressable
              accessibilityRole={onPress ? "button" : undefined}
              accessibilityLabel={onPress ? `Select ${item.name}` : undefined}
              disabled={!onPress}
              onPress={() => onPress?.(item.id)}
              style={{
                width: "100%",
                height: "100%",
                paddingTop: 10,
                alignItems: "center",
                gap: 4,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                borderWidth: 1,
                borderColor: `${color.slice(0, 7)}40`,
                backgroundColor: `${color.slice(0, 7)}18`,
              }}
            >
              {item.picture ? (
                <Image
                  source={{ uri: item.picture }}
                  style={{
                    height: 40,
                    width: 40,
                    borderRadius: 20,
                    borderColor: color,
                    borderWidth: 2,
                  }}
                />
              ) : item.emoji ? (
                <StoryText size={36}>{item.emoji}</StoryText>
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: `${color.slice(0, 7)}30`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <StoryText size={20}>{(item.name || "t")[0]}</StoryText>
                </View>
              )}
              {!item.emoji && (
                <StoryText size={10} numberOfLines={1}>
                  {item.name}
                </StoryText>
              )}
              <StoryText size={11} style={{ color, fontWeight: "700" }}>
                {rank + 1}
              </StoryText>
            </Pressable>
          </StoryReveal>
        );
      })}
    </View>
  );
}
