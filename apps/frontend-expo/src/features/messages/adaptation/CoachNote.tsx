import { Image, View } from "react-native";
import { useColors } from "@/components/ui";
import { coachMoodAvatar } from "@/features/coach/avatar";
import type { CoachNoteProps } from "./types";

/** The coach's face beside a speech bubble: why the plan changes, in its words. */
export function CoachNote({ strategist, mood, children }: CoachNoteProps) {
  const c = useColors();
  return (
    <View testID="coach-note" style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
      <Image
        accessibilityIgnoresInvertColors
        source={coachMoodAvatar(strategist, mood)}
        style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.soft }}
      />
      <View
        style={{
          flex: 1,
          minWidth: 0,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          borderBottomLeftRadius: 6,
          backgroundColor: c.soft,
        }}
      >
        {children}
      </View>
    </View>
  );
}
