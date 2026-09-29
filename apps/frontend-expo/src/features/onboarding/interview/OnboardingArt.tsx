import { useEffect } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useColors } from "@/components/ui";
import type {
  FloatingProps,
  OnboardingArtName,
  OnboardingArtProps,
  OnboardingArtSource,
} from "./types";

// Clay illustrations. Where there's a loop it's a short animated WebP; with Reduce
// Motion on, the still is shown instead.
const art: Record<OnboardingArtName, OnboardingArtSource> = {
  welcome: { still: require("../../../../assets/onboarding/welcome.png") },
  goal: {
    still: require("../../../../assets/onboarding/goal.png"),
    motion: require("../../../../assets/onboarding/goal.webp"),
  },
  baseline: {
    still: require("../../../../assets/onboarding/start.png"),
    motion: require("../../../../assets/onboarding/start.webp"),
  },
  motivation: {
    still: require("../../../../assets/onboarding/why.png"),
    motion: require("../../../../assets/onboarding/why.webp"),
  },
  rhythm: { still: require("../../../../assets/onboarding/week.png") },
  support: { still: require("../../../../assets/onboarding/support.png") },
  circle: {
    still: require("../../../../assets/onboarding/circle.png"),
    motion: require("../../../../assets/onboarding/circle.webp"),
  },
  match: { still: require("../../../../assets/onboarding/match.png") },
  review: { still: require("../../../../assets/onboarding/plan.png") },
};

// The welcome balloon drifts up and back; its shadow shrinks as it rises.
function Floating({ children }: FloatingProps) {
  const lift = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    lift.value = withRepeat(withTiming(1, { duration: 2250, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [lift, reduced]);
  const balloon = useAnimatedStyle(() => ({
    transform: [{ translateY: -10 * lift.value }, { rotate: `${-2 + 4 * lift.value}deg` }],
  }));
  const shadow = useAnimatedStyle(() => ({
    opacity: 0.22 - 0.1 * lift.value,
    transform: [{ scaleX: 1 - 0.3 * lift.value }],
  }));
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <Animated.View style={balloon}>{children}</Animated.View>
      <Animated.View
        style={[{ width: 64, height: 10, borderRadius: 999, backgroundColor: "#000" }, shadow]}
      />
    </View>
  );
}

export function OnboardingArt({ name, size = 176 }: OnboardingArtProps) {
  const c = useColors();
  const reduced = useReducedMotion();
  const { still, motion } = art[name];
  const image = (
    <Image
      source={!reduced && motion ? motion : still}
      style={{ width: size * 0.78, height: size * 0.78 }}
      contentFit="contain"
      accessible={false}
    />
  );
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.selectedBg,
        alignItems: "center",
        justifyContent: "center",
        alignSelf: "center",
      }}
    >
      {name === "welcome" ? <Floating>{image}</Floating> : image}
    </View>
  );
}
