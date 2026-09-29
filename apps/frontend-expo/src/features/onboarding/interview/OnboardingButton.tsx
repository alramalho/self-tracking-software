import { ActivityIndicator, Pressable } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { EditorButtonProps } from "@/features/activities/editor/types";

// The one dominant action on an onboarding screen: full width, rounded, accent colour.
export function OnboardingButton({
  label,
  accessibilityLabel,
  onPress,
  busy,
  disabled,
  icon: Icon,
}: EditorButtonProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(busy || disabled) }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 54,
        borderRadius: 16,
        backgroundColor: c.accent,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 16,
        opacity: busy || disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {Icon && <Icon size={18} color="#fff" />}
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600" }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
