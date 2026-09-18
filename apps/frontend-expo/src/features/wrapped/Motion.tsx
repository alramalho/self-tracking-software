import { createContext, useContext, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";
import type { StoryRevealProps } from "./types";

export const StoryReducedMotion = createContext(false);
export function useStoryMotionPreference() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

export function StoryReveal({
  children,
  delay = 0,
  duration = 400,
  rise = 20,
  height,
  testID,
  style,
}: StoryRevealProps) {
  const reduced = useContext(StoryReducedMotion);
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = height
      ? Animated.sequence([
          Animated.delay(delay),
          Animated.spring(progress, {
            toValue: 1,
            stiffness: 200,
            damping: 20,
            mass: 1,
            useNativeDriver: false,
          }),
        ])
      : Animated.timing(progress, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        });
    animation.start();
    return () => animation.stop();
  }, [reduced, delay, duration, rise, height, progress]);
  return (
    <Animated.View
      testID={testID}
      style={[
        style,
        { opacity: progress },
        height != null
          ? {
              height: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, height],
              }),
            }
          : {
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [rise, 0],
                  }),
                },
              ],
            },
      ]}
    >
      {children}
    </Animated.View>
  );
}
