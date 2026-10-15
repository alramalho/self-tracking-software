import { useEffect, useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { confidenceLabel } from "./confidence";
import type { ConfidenceDialProps } from "./types";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// A half-circle gauge from 1 (left) to 10 (right). Drag or tap along it to set the score.
// On first appearance the needle sweeps to full and settles back, like a car dashboard waking up.
export function ConfidenceDial({ score, onChange, compact = false, voice = 0 }: ConfidenceDialProps) {
  const c = useColors();
  const reduced = useReducedMotion();
  const width = compact ? 180 : 300;
  const stroke = compact ? 14 : 22;
  const radius = (width - stroke) / 2 - 6;
  const cx = width / 2;
  const cy = radius + stroke / 2 + 6;
  const height = cy + (compact ? 10 : 18);
  const length = Math.PI * radius;
  const fill = useSharedValue(reduced || compact ? score / 10 : 0);
  const pop = useSharedValue(1);
  const glow = useSharedValue(0);
  const shown = useRef(false);

  // Sweep up to full, then settle on the score.
  useEffect(() => {
    if (reduced || compact) return;
    fill.value = withDelay(
      250,
      withSequence(withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }), withTiming(score / 10, { duration: 750, easing: Easing.inOut(Easing.cubic) })),
    );
    // Only on first appearance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shown.current) {
      shown.current = true;
      return;
    }
    fill.value = reduced ? score / 10 : withTiming(score / 10, { duration: 280, easing: Easing.out(Easing.cubic) });
    if (!reduced && !compact) pop.value = withSequence(withTiming(1.12, { duration: 90 }), withSpring(1, { damping: 10, stiffness: 260 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  useEffect(() => {
    glow.value = reduced ? 0 : withTiming(voice, { duration: 120 });
  }, [voice, reduced, glow]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - fill.value) }));
  const knob = useAnimatedProps(() => {
    const angle = Math.PI * (1 - fill.value);
    return { cx: cx + radius * Math.cos(angle), cy: cy - radius * Math.sin(angle) };
  });
  const halo = useAnimatedProps(() => ({ strokeWidth: stroke + 22 * glow.value, strokeOpacity: 0.08 + 0.22 * glow.value }));
  const number = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const pick = (x: number, y: number) => {
    if (!onChange) return;
    // Angle from the centre: 180° on the left (1) to 0° on the right (10).
    const angle = Math.atan2(Math.max(0, cy - y), x - cx);
    const next = Math.max(1, Math.min(10, Math.ceil((1 - angle / Math.PI) * 10)));
    if (next !== score) onChange(next);
  };
  const pan = Gesture.Pan().runOnJS(true).minDistance(0).onBegin((e) => pick(e.x, e.y)).onUpdate((e) => pick(e.x, e.y));
  const arcPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;

  const dial = (
    <View
      testID={compact ? "confidence-dial-compact" : "confidence-dial"}
      accessible
      accessibilityRole={onChange ? "adjustable" : "image"}
      accessibilityLabel="How sure you are"
      accessibilityValue={{ min: 1, max: 10, now: score, text: `${score} out of 10, ${confidenceLabel(score)}` }}
      accessibilityActions={onChange ? [{ name: "increment" }, { name: "decrement" }] : undefined}
      onAccessibilityAction={(e) => onChange?.(Math.max(1, Math.min(10, score + (e.nativeEvent.actionName === "increment" ? 1 : -1))))}
      style={{ width, height, alignSelf: "center" }}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="confidence-fill" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={c.selectedBorder} />
            <Stop offset="1" stopColor={c.accent} />
          </LinearGradient>
        </Defs>
        {/* Voice halo: widens and brightens with the person's voice while they answer. */}
        <AnimatedPath d={arcPath} stroke={c.accent} fill="none" strokeLinecap="round" animatedProps={halo} />
        <Path d={arcPath} stroke={c.soft} strokeWidth={stroke} fill="none" strokeLinecap="round" />
        <AnimatedPath
          d={arcPath}
          stroke="url(#confidence-fill)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${length} ${length}`}
          animatedProps={arc}
        />
        {!compact && <AnimatedCircle r={stroke / 2 + 5} fill="#fff" stroke={c.accent} strokeWidth={3} animatedProps={knob} />}
      </Svg>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: compact ? 0 : 6, alignItems: "center" }}>
        <Animated.View style={number}>
          <Text testID="confidence-score" style={{ color: c.text, fontSize: compact ? 40 : 72, lineHeight: compact ? 46 : 80, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
            {score}
          </Text>
        </Animated.View>
        {!compact && <Text style={{ color: c.muted, fontSize: 15, fontWeight: "600" }}>{confidenceLabel(score)}</Text>}
      </View>
    </View>
  );
  if (!onChange) return dial;
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <GestureDetector gesture={pan}>{dial}</GestureDetector>
      <View style={{ width: width - 12, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: c.muted, fontSize: 13 }}>1</Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>10</Text>
      </View>
    </View>
  );
}
