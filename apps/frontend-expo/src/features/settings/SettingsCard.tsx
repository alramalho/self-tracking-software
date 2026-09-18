import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { SettingsCardProps } from "./types";
export function SettingsCard({
  title,
  description,
  icon: Icon,
  iconBackground = true,
  color,
  onPress,
  trailing,
  children,
  disabled,
}: SettingsCardProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? title : undefined}
      disabled={!onPress || disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: Icon ? 16 : 8,
        padding: Icon ? 16 : 12,
        backgroundColor: c.soft + "80",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: disabled ? 0.5 : pressed ? 0.65 : 1,
      })}
    >
      {Icon && (
        <View
          style={{
            ...(iconBackground
              ? {
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: (color || c.accent) + "22",
                }
              : {}),
          }}
        >
          <Icon size={24} color={color || c.accent} />
        </View>
      )}
      {children}
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={{
            color: c.text,
            fontSize: Icon ? 16 : 14,
            fontWeight: Icon ? "600" : "500",
          }}
        >
          {title}
        </Text>
        {!!description && (
          <Text
            style={{
              color: c.muted,
              fontSize: Icon ? 14 : 12,
              lineHeight: Icon ? 20 : 17,
            }}
          >
            {description}
          </Text>
        )}
      </View>
      {trailing || (onPress && <ChevronRight size={20} color={c.muted} />)}
    </Pressable>
  );
}
