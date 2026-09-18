import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { useColors } from "@/components/ui";
import { EditorButton } from "@/features/activities/editor/controls";
import type { AutoContinueActionProps } from "./types";

const AUTO_CONTINUE_MILLIS = 12000;

export function AutoContinueAction({
  label,
  onContinue,
}: AutoContinueActionProps) {
  const colors = useColors();
  const progress = useRef(new Animated.Value(0)).current;
  const completed = useRef(false);
  const continueRef = useRef(onContinue);
  continueRef.current = onContinue;

  function finish() {
    if (completed.current) return;
    completed.current = true;
    progress.stopAnimation();
    continueRef.current();
  }

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: AUTO_CONTINUE_MILLIS,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished) finish();
    });
    return () => animation.stop();
  }, [progress]);

  return (
    <View style={{ gap: 7 }}>
      <EditorButton label={label} onPress={finish} />
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Automatic continue"
        accessibilityValue={{ min: 0, max: AUTO_CONTINUE_MILLIS }}
        style={{
          height: 3,
          overflow: "hidden",
          borderRadius: 2,
          backgroundColor: colors.soft,
        }}
      >
        <Animated.View
          style={{
            height: "100%",
            borderRadius: 2,
            backgroundColor: colors.accent,
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          }}
        />
      </View>
    </View>
  );
}
