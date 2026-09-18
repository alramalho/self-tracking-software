import { Text } from "@/components/typography/Text";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useColors } from "@/components/ui";
import type { PlanTileProps } from "./types";
export function PlanTile({
  plan,
  index,
  count,
  columns,
  size,
  selected,
  disabled,
  onSelect,
  onMove,
}: PlanTileProps) {
  const c = useColors();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const dragging = useSharedValue(false);
  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(300)
    .onStart(() => {
      dragging.value = true;
    })
    .onUpdate((event) => {
      x.value = event.translationX;
      y.value = event.translationY;
    })
    .onEnd((event) => {
      const column = Math.max(
        0,
        Math.min(
          columns - 1,
          (index % columns) + Math.round(event.translationX / (size + 12)),
        ),
      );
      const row = Math.max(
        0,
        Math.floor(index / columns) +
          Math.round(event.translationY / (size + 12)),
      );
      scheduleOnRN(onMove, Math.min(count - 1, row * columns + column));
    })
    .onFinalize(() => {
      dragging.value = false;
      x.value = withSpring(0);
      y.value = withSpring(0);
    });
  const tap = Gesture.Tap().onEnd((_, success) => {
    if (success) scheduleOnRN(onSelect);
  });
  const style = useAnimatedStyle(() => ({
    zIndex: dragging.value ? 10 : 0,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: withSpring(dragging.value ? 1.08 : 1) },
    ],
  }));
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={plan.goal}
        accessibilityHint="Hold and drag to reorder"
        accessibilityState={{ selected, disabled }}
        onAccessibilityTap={onSelect}
        accessibilityActions={[
          { name: "activate", label: "Select plan" },
          { name: "increment", label: "Move later" },
          { name: "decrement", label: "Move earlier" },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "activate") onSelect();
          else if (!disabled)
            onMove(
              event.nativeEvent.actionName === "increment"
                ? Math.min(count - 1, index + 1)
                : Math.max(0, index - 1),
            );
        }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: selected ? c.accent : c.border,
            backgroundColor: c.card,
            alignItems: "center",
            justifyContent: "center",
            opacity: plan.archivedAt ? 0.5 : 1,
          },
          style,
        ]}
      >
        <Text style={{ fontSize: 48 }}>
          {plan.emoji || plan.goal.slice(0, 2)}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}
