import { Image, View } from "react-native";
import { useColors } from "@/components/ui";
import { coachMoodAvatar } from "@/features/coach/avatar";
import type { CoachNoteProps } from "./types";

/** The coach's face beside a speech bubble: why the plan changes, in its words. */
export function CoachNote({ strategist, mood, size = "regular", children }: CoachNoteProps) {
  const c = useColors();
  const face = size === "small" ? 38 : 56;
  return (
    <View testID="coach-note" style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
      <Image
        accessibilityIgnoresInvertColors
        source={coachMoodAvatar(strategist, mood)}
        style={{ width: face, height: face }}
      />
      <View
        style={{
          flex: 1,
          minWidth: 0,
          paddingHorizontal: size === "small" ? 12 : 14,
          paddingVertical: size === "small" ? 8 : 10,
          borderRadius: size === "small" ? 14 : 18,
          borderBottomLeftRadius: 6,
          backgroundColor: c.soft,
        }}
      >
        {children}
      </View>
    </View>
  );
}
