import { useEffect, useId, useState } from "react";
import { View } from "react-native";
import { useIsFocused } from "expo-router";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/components/ui";
import type { AchievementGlowProps } from "./types";
const MovingGradient = Animated.createAnimatedComponent(RadialGradient);

/** The PWA's ten-second border glimmer, with a quiet static state for Reduce Motion. */
export function AchievementGlow({ color }: AchievementGlowProps) {
  const c = useColors(),
    focused = useIsFocused(),
    reduced = useReducedMotion();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);
  useEffect(() => {
    if (focused && !reduced)
      progress.value = withRepeat(
        withTiming(1, { duration: 10000, easing: Easing.linear }),
        -1,
        false,
      );
    else {
      cancelAnimation(progress);
      progress.value = 0.25;
    }
    return () => cancelAnimation(progress);
  }, [focused, reduced, progress]);
  const gradient = useAnimatedProps(() => ({
    cx: size.width * (0.5 + 0.7 * Math.cos(progress.value * Math.PI * 2)),
    cy: size.height * (0.5 + 0.7 * Math.sin(progress.value * Math.PI * 2)),
    fx: size.width * (0.5 + 0.7 * Math.cos(progress.value * Math.PI * 2)),
    fy: size.height * (0.5 + 0.7 * Math.sin(progress.value * Math.PI * 2)),
  }));
  return (
    <View
      pointerEvents="none"
      testID="plan-achievement-glimmer"
      style={{ position: "absolute", inset: 0 }}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
    >
      {size.width > 0 && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={`${id}bg`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0" stopColor={color} stopOpacity={0} />
              <Stop offset="0.45" stopColor={color} stopOpacity={0} />
              <Stop
                offset="1"
                stopColor={c.dark ? "#92400e" : color}
                stopOpacity={c.dark ? 0.4 : 0.16}
              />
            </LinearGradient>
            <MovingGradient
              id={`${id}shine`}
              animatedProps={gradient}
              rx={Math.max(size.width, size.height) * 0.8}
              ry={Math.max(size.width, size.height) * 0.8}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={color} stopOpacity={0} />
              <Stop offset="0.45" stopColor={color} stopOpacity={1} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </MovingGradient>
          </Defs>
          <Rect
            width={size.width}
            height={size.height}
            rx={16}
            fill={`url(#${id}bg)`}
          />
          <Rect
            x={1}
            y={1}
            width={size.width - 2}
            height={size.height - 2}
            rx={15}
            fill="none"
            stroke={`url(#${id}shine)`}
            strokeWidth={2}
          />
        </Svg>
      )}
    </View>
  );
}
