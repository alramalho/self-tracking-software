import { useContext, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { RevealSettledContext } from "@/components/reveal/Reveal";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { FeedCaptionProps } from "./types";
export function FeedCaption({ text, overlay = false }: FeedCaptionProps) {
  const c = useColors();
  const revealed = useContext(RevealSettledContext);
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  const glass =
    revealed &&
    overlay &&
    Platform.OS === "ios" &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();
  // PWA parity: caption pill uses theme-tinted glassBg
  // (e.g. amber dark:bg-amber-800/40) + backdrop-blur-lg + border-white/20.
  // fadedBg is the closest native hue; ensure translucency when the light
  // value is opaque so blur stays visible like the PWA.
  const baseTint = c.fadedBg;
  const tint = baseTint.length === 7 ? `${baseTint}66` : baseTint;
  return (
    <View
      style={
        overlay
          ? {
              marginTop: -24,
              marginHorizontal: 8,
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              overflow: "hidden",
              borderColor: c.dark ? "#ffffff33" : "#ffffff40",
              // Always keep the translucent tint as a backup so the pill
              // stays readable while GlassView mounts (reveal gating delays
              // it ~500ms) or if glass fails on that card. GlassView adds
              // blur on top when ready.
              backgroundColor: tint,
              ...(Platform.OS === "web"
                ? {
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                  }
                : {}),
            }
          : { marginTop: 12 }
      }
    >
      {glass && (
        <GlassView
          pointerEvents="none"
          glassEffectStyle="clear"
          colorScheme={c.dark ? "dark" : "light"}
          tintColor={tint}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
        />
      )}
      <Text
        style={{
          color: c.text,
          fontSize: 14,
          lineHeight: 21,
          fontWeight: overlay ? "500" : "400",
          ...(overlay
            ? {
                textShadowColor: c.dark ? "#00000070" : "#ffffff90",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }
            : {}),
        }}
        numberOfLines={expanded ? undefined : 3}
        onTextLayout={(event) => {
          if (event.nativeEvent.lines.length > 3) setLong(true);
        }}
      >
        {text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
          /^https?:\/\//.test(part) ? (
            <Text
              key={i}
              accessibilityRole="link"
              onPress={() => void Linking.openURL(part)}
              style={{ color: c.accent }}
            >
              {part}
            </Text>
          ) : (
            part
          ),
        )}
      </Text>
      {(long || text.length > 180) && (
        <Text
          accessibilityRole="button"
          onPress={() => setExpanded(!expanded)}
          style={{
            color: c.muted,
            textDecorationLine: "underline",
            fontSize: 12,
            paddingTop: 6,
          }}
        >
          {expanded ? "Show less" : "Read more"}
        </Text>
      )}
    </View>
  );
}
