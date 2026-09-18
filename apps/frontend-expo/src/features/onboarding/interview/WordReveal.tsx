import { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Animated, View } from "react-native";
import { useColors } from "@/components/ui";
import type { WordRevealProps } from "./types";

export function WordReveal({ children: message, onComplete }: WordRevealProps) {
  const colors = useColors();
  const words = useMemo(() => message.trim().split(/\s+/), [message]);
  const opacities = useMemo(
    () => words.map(() => new Animated.Value(0)),
    [words],
  );
  const complete = useRef(onComplete);
  complete.current = onComplete;

  useEffect(() => {
    let alive = true;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!alive) return;
      if (reduced) {
        opacities.forEach((opacity) => opacity.setValue(1));
        complete.current();
        return;
      }
      animation = Animated.stagger(
        65,
        opacities.map((opacity) =>
          Animated.timing(opacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
        ),
      );
      animation.start(({ finished }) => {
        if (finished && alive) complete.current();
      });
    });
    return () => {
      alive = false;
      animation?.stop();
    };
  }, [opacities]);

  return (
    <View accessible accessibilityLabel={message} style={{ width: "100%" }}>
      <Animated.Text
        importantForAccessibility="no-hide-descendants"
        style={{
          color: colors.text,
          fontSize: 23,
          lineHeight: 34,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {words.map((word, index) => (
          <Animated.Text
            key={`${word}-${index}`}
            style={{ opacity: opacities[index] }}
          >
            {word}
            {index === words.length - 1 ? "" : " "}
          </Animated.Text>
        ))}
      </Animated.Text>
    </View>
  );
}
