import { useContext, useRef } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { RevealSettledContext } from "@/components/reveal/Reveal";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import type { ReactionBadgeProps } from "./types";

export function ReactionBadge({
  emoji,
  count,
  selected,
  overlay,
  onOpen,
}: ReactionBadgeProps) {
  const c = useColors();
  const revealed = useContext(RevealSettledContext);
  const ref = useRef<View>(null);
  const glass =
    revealed &&
    overlay &&
    Platform.OS === "ios" &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();
  const tint = selected ? `${c.accent}38` : c.dark ? "#ffffff14" : "#ffffff38";
  return (
    <Pressable
      ref={ref}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={`${emoji} ${count}`}
      accessibilityHint={
        selected ? "You reacted. See who reacted" : "See who reacted"
      }
      accessibilityState={{ selected }}
      testID={`reaction-badge-${emoji}`}
      onPress={() =>
        ref.current?.measureInWindow((x, y, width, height) =>
          onOpen({ x, y, width, height }),
        )
      }
      style={{
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
        borderRadius: 999,
        minHeight: 40,
        paddingHorizontal: 10,
        paddingVertical: 6,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: selected
          ? `${c.accent}b3`
          : overlay
            ? "#ffffff40"
            : c.border,
        // Always keep the translucent tint as a backup so the pill stays
        // readable while GlassView mounts (reveal gating delays it ~500ms)
        // or if iOS drops blur on that card. GlassView adds blur on top
        // when ready instead of replacing a transparent background.
        backgroundColor: overlay
          ? tint
          : selected
            ? c.selectedBg
            : c.soft,
        ...(overlay && Platform.OS === "web"
          ? { backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }
          : {}),
      }}
    >
      {glass && (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="clear"
          colorScheme={c.dark ? "dark" : "light"}
          tintColor={tint}
          style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
        />
      )}
      <Text style={{ fontSize: 16 }}>{emoji}</Text>
      <Text
        style={{
          color: c.text,
          fontSize: 14,
          fontWeight: "500",
          ...(overlay
            ? {
                textShadowColor: c.dark ? "#00000070" : "#ffffff90",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }
            : {}),
        }}
      >
        {count}
      </Text>
    </Pressable>
  );
}
