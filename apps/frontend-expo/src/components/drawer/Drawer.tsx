import { ActivityIndicator, Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { PreviewSheet } from "@/features/messages/entities/PreviewSheet";
import type {
  DrawerButtonProps,
  DrawerHeaderProps,
  DrawerOptionsProps,
  DrawerProps,
} from "./types";

// The app's drawer: a bottom sheet sized to its content, closed with the X, a swipe or a tap outside.
// Inside, in this order: a centered header, a card of vertical options, at most one main button.
export function Drawer({ visible, label, onClose, children }: DrawerProps) {
  return (
    <PreviewSheet visible={visible} title={label} onClose={onClose}>
      <View style={{ gap: 18 }}>{children}</View>
    </PreviewSheet>
  );
}

export function DrawerHeader({ emoji, title, subtitle }: DrawerHeaderProps) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", gap: 6, paddingHorizontal: 32, paddingTop: 8 }}>
      {!!emoji && <Text style={{ fontSize: 40, lineHeight: 48 }}>{emoji}</Text>}
      <Text
        accessibilityRole="header"
        style={{ color: c.text, fontSize: 20, fontWeight: "700", textAlign: "center" }}
      >
        {title}
      </Text>
      {!!subtitle && (
        <Text style={{ color: c.muted, fontSize: 14, textAlign: "center" }}>{subtitle}</Text>
      )}
    </View>
  );
}

export function DrawerOptions({ label, options }: DrawerOptionsProps) {
  const c = useColors();
  return (
    <View style={{ gap: 8 }}>
      {!!label && (
        <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600", paddingHorizontal: 4 }}>
          {label}
        </Text>
      )}
      <View style={{ backgroundColor: c.card, borderRadius: 16, overflow: "hidden" }}>
        {options.map((option, index) => (
          <Pressable
            key={option.label}
            testID={option.testID}
            accessibilityRole={option.trailing ? undefined : "button"}
            accessibilityLabel={option.label}
            disabled={option.disabled || (!option.onPress && !option.trailing)}
            onPress={option.onPress}
            style={({ pressed }) => ({
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 18,
              borderTopWidth: index ? 1 : 0,
              borderColor: c.border,
              backgroundColor: pressed && option.onPress ? c.soft : "transparent",
              opacity: option.disabled ? 0.45 : 1,
            })}
          >
            {!!option.emoji && <Text style={{ fontSize: 22, lineHeight: 28 }}>{option.emoji}</Text>}
            <Text
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: "500",
                color: option.destructive ? "#dc2626" : c.text,
              }}
            >
              {option.label}
            </Text>
            {option.trailing ? (
              <View style={{ alignSelf: "center" }}>{option.trailing}</View>
            ) : option.onPress && !option.destructive ? (
              <ChevronRight size={18} color={c.muted} />
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function DrawerButton({ label, onPress, busy, disabled, testID }: DrawerButtonProps) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 54,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.accent,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>{label}</Text>
      )}
    </Pressable>
  );
}
