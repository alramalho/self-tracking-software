import { ActivityIndicator, Pressable, TextInput } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import { VoiceTextArea } from "@/features/dictation/VoiceTextArea";
import type { EditorButtonProps, EditorInputProps } from "./types";

export function EditorInput({ label, style, ...props }: EditorInputProps) {
  const c = useColors();
  const inputStyle = [
    {
      minHeight: 44,
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: c.text,
      borderColor: c.inputBorder,
      backgroundColor: c.soft,
    },
    style,
  ];
  return props.multiline ? (
    <VoiceTextArea
      accessibilityLabel={label}
      testID={`editor-${label}`}
      placeholderTextColor={c.muted}
      inputAccessoryViewID="logging-input-done"
      dictationLabel={label.toLowerCase()}
      {...props}
      style={inputStyle}
    />
  ) : (
    <TextInput
      accessibilityLabel={label}
      testID={`editor-${label}`}
      placeholderTextColor={c.muted}
      inputAccessoryViewID="logging-input-done"
      returnKeyType="done"
      {...props}
      style={inputStyle}
    />
  );
}
export function EditorButton({
  label,
  accessibilityLabel,
  onPress,
  secondary,
  destructive,
  busy,
  disabled,
  icon: Icon,
}: EditorButtonProps) {
  const c = useColors();
  const color = secondary
    ? destructive
      ? "#ef4444"
      : c.text
    : destructive
      ? "#fff"
      : c.dark
        ? "#27272a"
        : "#fafafa";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(busy || disabled) }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        borderRadius: 12,
        borderWidth: secondary ? 1 : 0,
        borderColor: c.inputBorder,
        backgroundColor: secondary
          ? c.soft
          : destructive
            ? "#dc2626"
            : c.dark
              ? "#fafafa"
              : "#18181b",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        opacity: busy || disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {Icon && <Icon size={16} color={color} />}
          <Text style={{ color, fontSize: 14, fontWeight: "500" }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
