import { Platform, Pressable } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import type { MessageIconProps } from "./types";
const TouchTarget = Platform.OS === "web" ? Pressable : TouchableOpacity;
export function IconButton({
  label,
  children,
  onPress,
  disabled,
}: MessageIconProps) {
  return (
    <TouchTarget
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 22,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </TouchTarget>
  );
}
