import { Platform, Pressable, StyleSheet, View } from "react-native";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { ChevronRight, CircleAlert } from "lucide-react-native";
import { useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import type { AttentionIslandProps } from "../types";

export const attentionLabel = (count: number) =>
  count === 1
    ? "1 plan update needs attention"
    : `${count} plan updates need attention`;

// A notification-style pill floating over the top of the thread. Tapping it
// drafts the coach prompt; it takes no space from the conversation.
export function AttentionIsland({ count, top, onPress }: AttentionIslandProps) {
  const c = useColors();
  const label = attentionLabel(count);
  const glass =
    Platform.OS === "ios" &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();
  // The tint keeps the pill readable over text while (or when no) blur renders.
  const tint = c.dark ? "#2a2a2ee0" : "#ffffffe6";
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top, left: 16, right: 16, alignItems: "center" }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Drafts a message asking the coach to review it"
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
          paddingLeft: 14,
          paddingRight: 10,
          borderRadius: 22,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.dark ? "#ffffff24" : "#00000014",
          backgroundColor: glass ? "transparent" : tint,
          shadowColor: "#000",
          shadowOpacity: c.dark ? 0.4 : 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
          opacity: pressed ? 0.8 : 1,
          ...(Platform.OS === "web"
            ? { backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }
            : {}),
        })}
      >
        {glass && (
          <GlassView
            pointerEvents="none"
            glassEffectStyle="regular"
            colorScheme={c.dark ? "dark" : "light"}
            style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
          />
        )}
        <CircleAlert size={17} color={c.accent} />
        <Text style={{ color: c.text, fontSize: 14, fontWeight: "500" }}>
          {label}
        </Text>
        <ChevronRight size={16} color={c.muted} />
      </Pressable>
    </View>
  );
}
