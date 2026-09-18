import { useEffect, useRef } from "react";
import { Platform, Pressable, View } from "react-native";
import LottieView from "lottie-react-native";
import { useIsFocused } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";
import { Flame, Rocket, Sprout } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { AchievementBadgeProps } from "./types";

const animations = {
  streaks: require("../../../assets/animations/fire.json"),
  habits: require("../../../assets/animations/seed.json"),
  lifestyles: require("../../../assets/animations/rocket.json"),
};
const icons = { streaks: Flame, habits: Sprout, lifestyles: Rocket };

export function AchievementBadge({
  kind,
  count,
  onPress,
}: AchievementBadgeProps) {
  const c = useColors();
  const focused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const animation = useRef<LottieView>(null);
  const animate = focused && !reducedMotion;
  useEffect(() => {
    if (animate) animation.current?.play();
    else animation.current?.pause();
  }, [animate, count]);
  const Icon = icons[kind];
  return (
    <Pressable
      testID={`profile-badge-${kind}`}
      accessibilityRole="button"
      accessibilityLabel={`${count} ${kind}`}
      onPress={onPress}
      style={{ width: 50, height: 62, opacity: count ? 1 : 0.5 }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -2,
          left: -2,
          right: -2,
          bottom: -2,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: c.border,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          width: 50,
          height: 62,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: c.card,
        }}
      >
        <Text
          style={{
            position: "absolute",
            left: 8,
            top: 0,
            fontFamily: "Caveat",
            fontSize: 20,
            lineHeight: 28,
            color: c.text,
          }}
        >
          x{count}
        </Text>
        {count > 0 ? (
          <View
            testID={`profile-animation-${kind}`}
            accessible={false}
            style={{ width: 65, height: 65 }}
          >
            <LottieView
              ref={animation}
              source={animations[kind]}
              autoPlay={animate}
              loop
              progress={
                reducedMotion && Platform.OS !== "web" ? 0.5 : undefined
              }
              resizeMode="cover"
              style={{ width: 65, height: 65 }}
              webStyle={{ width: 65, height: 65 }}
            />
          </View>
        ) : (
          <Icon
            size={55}
            color={c.muted}
            strokeWidth={2}
            style={{ marginTop: 12, marginBottom: 4 }}
          />
        )}
      </View>
    </Pressable>
  );
}
