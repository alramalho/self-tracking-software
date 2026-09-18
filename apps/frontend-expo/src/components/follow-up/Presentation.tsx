import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type {
  EntranceProps,
  FollowUpHeaderProps,
  FollowUpActionsProps,
} from "./types";

export function Entrance({
  children,
  delay = 0,
  spring = false,
}: EntranceProps) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const config = {
      toValue: 1,
      delay,
      useNativeDriver: Platform.OS !== "web",
    };
    const animation = spring
      ? Animated.spring(progress, {
          ...config,
          stiffness: 200,
          damping: 16,
          mass: 1,
        })
      : Animated.timing(progress, {
          ...config,
          duration: 350,
          easing: Easing.out(Easing.cubic),
        });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduced, spring]);
  return (
    <Animated.View
      style={{
        opacity: spring ? 1 : progress,
        transform: spring
          ? [{ scale: progress }]
          : [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
      }}
    >
      {children}
    </Animated.View>
  );
}

export function FollowUpHeader({
  icon,
  title,
  description,
}: FollowUpHeaderProps) {
  const c = useColors();
  return (
    <View style={{ gap: 12 }}>
      <Entrance delay={200} spring>
        <View style={{ alignItems: "center", marginBottom: 4 }}>{icon}</View>
      </Entrance>
      <Entrance delay={300}>
        <Text
          accessibilityRole="header"
          style={{
            textAlign: "center",
            fontSize: 20,
            fontWeight: "700",
            color: c.text,
          }}
        >
          {title}
        </Text>
      </Entrance>
      {description && (
        <Entrance delay={350}>
          <Text
            style={{
              textAlign: "center",
              fontSize: 14,
              lineHeight: 20,
              color: c.muted,
            }}
          >
            {description}
          </Text>
        </Entrance>
      )}
    </View>
  );
}

export function FollowUpActions({
  onSkip,
  onDone,
  busy,
  disabled,
}: FollowUpActionsProps) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 8,
        paddingTop: 8,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip"
        disabled={busy}
        onPress={onSkip}
        style={{
          minHeight: 44,
          paddingHorizontal: 16,
          justifyContent: "center",
          opacity: busy ? 0.5 : 1,
        }}
      >
        <Text style={{ color: c.muted, fontWeight: "500" }}>Skip</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? "Saving..." : "Done"}
        accessibilityState={{ disabled: !!disabled || !!busy }}
        disabled={disabled || busy}
        onPress={onDone}
        style={{
          minHeight: 44,
          borderRadius: 12,
          paddingHorizontal: 18,
          justifyContent: "center",
          backgroundColor: c.accent,
          opacity: disabled || busy ? 0.45 : 1,
        }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>
          {busy ? "Saving..." : "Done"}
        </Text>
      </Pressable>
    </View>
  );
}

export function CheckInPulse() {
  const c = useColors();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return (
    <View
      style={{
        width: 12,
        height: 12,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          position: "absolute",
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: c.accent,
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.1, 0.35],
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 1.2],
              }),
            },
          ],
        }}
      />
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: c.accent,
        }}
      />
    </View>
  );
}
