import { Pressable, View } from "react-native";
import { Check, ChevronLeft, ChevronRight } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { ReviewLinkProps, ReviewRowProps } from "./types";

// Navigation and selection stay visually distinct from the committing action.
export function ReviewRow({
  title,
  detail,
  label,
  icon: Icon,
  emoji,
  selected,
  disabled,
  onPress,
}: ReviewRowProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ selected, disabled }}
      aria-pressed={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 60,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      {emoji ? (
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      ) : Icon ? (
        <Icon size={22} color={c.muted} strokeWidth={1.7} />
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: "500" }}>
          {title}
        </Text>
        {!!detail && (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
            {detail}
          </Text>
        )}
      </View>
      {selected === undefined ? (
        <ChevronRight size={18} color={c.muted} />
      ) : selected ? (
        <Check size={20} color={c.text} />
      ) : (
        <View style={{ width: 20 }} />
      )}
    </Pressable>
  );
}
export function ReviewLink({
  label,
  back,
  disabled,
  onPress,
}: ReviewLinkProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: back ? "flex-start" : "center",
        gap: 4,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      {back && <ChevronLeft size={18} color={c.muted} />}
      <Text style={{ color: c.muted, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
