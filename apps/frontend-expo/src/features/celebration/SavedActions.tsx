/**
 * What's left on screen once the "Nice work!" moment fades (20 Nov 2026): a big check, then "Share more" as
 * the one full-width button in the middle, and a quiet Done under it. Shared by the manual logger and the
 * voice note drawer, so both end the same way.
 */
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { CheckCircle2, Mic } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";

/** Near-black text on light accents (amber, emerald), white on dark ones: white on amber was ~2:1. */
export function textOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.3 ? "#09090b" : "#ffffff";
}

export function SavedActions({
  onShareMore,
  shareMoreLabel = "Share more",
  onDone,
  doneLabel = "Done",
  children,
  testID,
}: {
  /** Shows the big "Share more" button. */
  onShareMore?: () => void;
  /** "What did you cover?" on learning plans. */
  shareMoreLabel?: string;
  onDone: () => void;
  doneLabel?: string;
  /** Anything between the check and the buttons (the coach's coverage note). */
  children?: ReactNode;
  testID?: string;
}) {
  const c = useColors();
  const ink = textOn(c.accent);
  return (
    <View testID={testID} style={{ alignItems: "center", gap: 18, paddingTop: 8, paddingBottom: 4 }}>
      <CheckCircle2 size={64} color="#10b981" strokeWidth={1.8} accessibilityLabel="Saved" />
      {children}
      {onShareMore ? (
        <View style={{ alignSelf: "stretch", gap: 6, marginTop: 6 }}>
          <Pressable
            testID="saved-share-more"
            accessibilityRole="button"
            accessibilityLabel={shareMoreLabel}
            accessibilityHint="Say how it went and anything else"
            onPress={onShareMore}
            style={({ pressed }) => ({
              minHeight: 58,
              borderRadius: 29,
              backgroundColor: c.accent,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Mic size={21} color={ink} strokeWidth={2.3} />
            <Text style={{ color: ink, fontSize: 18, fontWeight: "700" }}>{shareMoreLabel}</Text>
          </Pressable>
          <Pressable
            testID="saved-done"
            accessibilityRole="button"
            accessibilityLabel={doneLabel}
            onPress={onDone}
            style={({ pressed }) => ({ minHeight: 48, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: c.muted, fontSize: 16, fontWeight: "600" }}>{doneLabel}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          testID="saved-done"
          accessibilityRole="button"
          accessibilityLabel={doneLabel}
          onPress={onDone}
          style={({ pressed }) => ({
            alignSelf: "stretch",
            minHeight: 58,
            borderRadius: 29,
            backgroundColor: c.accent,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: ink, fontSize: 18, fontWeight: "700" }}>{doneLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
