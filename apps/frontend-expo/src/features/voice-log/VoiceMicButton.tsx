import { Mic } from "lucide-react-native";
import { Image, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/components/ui";
import { useCurrentUser } from "@/data/queries";
import { coachIdentity } from "@/features/messages/coach";
import type { VoiceMicButtonProps } from "./types";

// Inside native tabs the bottom inset covers the tab bar, but the iOS glass tab bar also takes the
// touches of a ~40pt strip above it, so the mic floats clear of that.
const GAP = 48;

/**
 * The round mic in the bottom-right corner: one tap and it's listening. The coach's face sits on it, because the
 * note goes to the coach (owner, 26 Nov 2026: "make it understandable that you're talking to the coach").
 * A dot means a note is waiting.
 */
export function VoiceMicButton({ pending, onPress }: VoiceMicButtonProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const coach = coachIdentity(useCurrentUser().data?.coachPersonality);
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", right: 20, bottom: insets.bottom + GAP }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pending ? "Review voice note" : `Talk to ${coach.name}, your coach`}
        testID="voice-mic"
        onPress={onPress}
        style={({ pressed }) => ({
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.accent,
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <Mic size={28} color="white" strokeWidth={2.2} />
        <View
          testID="voice-mic-coach"
          style={{
            position: "absolute",
            top: -8,
            left: -10,
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.soft,
            borderWidth: 2,
            borderColor: c.bg,
          }}
        >
          <Image source={coach.avatar} style={{ width: 26, height: 26 }} resizeMode="contain" />
        </View>
        {pending && (
          <View
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: "#ef4444",
              borderWidth: 2,
              borderColor: c.bg,
            }}
          />
        )}
      </Pressable>
    </View>
  );
}
