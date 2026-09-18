import {
  Alert,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { forwardRef, useEffect, useRef } from "react";
import { errorMessage } from "@/data/api";
import { DictationButton } from "./DictationButton";

export function appendDictationText(current: string, transcript: string) {
  const text = transcript.trim();
  if (!text) return current;
  const existing = current.trimEnd();
  return `${existing}${existing ? " " : ""}${text}`;
}

export interface VoiceTextAreaProps extends TextInputProps {
  disabled?: boolean;
  dictationLabel?: string;
  onDictationBusyChange?: (busy: boolean) => void;
  onDictationError?: (error: unknown) => void;
  wrapperStyle?: StyleProp<ViewStyle>;
}

export const VoiceTextArea = forwardRef<TextInput, VoiceTextAreaProps>(
  function VoiceTextArea(
    {
      dictationLabel = "text",
      disabled,
      editable,
      onChangeText,
      onDictationBusyChange,
      onDictationError,
      style,
      value,
      wrapperStyle,
      ...props
    },
    ref,
  ) {
    const canEdit = !disabled && editable !== false;
    const valueRef = useRef(String(value ?? ""));
    useEffect(() => {
      valueRef.current = String(value ?? "");
    }, [value]);
    return (
      <View style={[{ position: "relative" }, wrapperStyle]}>
        <TextInput
          {...props}
          ref={ref}
          value={value}
          editable={canEdit}
          multiline
          onChangeText={onChangeText}
          style={[
            style,
            {
              paddingRight: 62,
              paddingBottom: 54,
              textAlignVertical: "top",
            } satisfies TextStyle,
          ]}
        />
        <View style={{ position: "absolute", right: 10, bottom: 10 }}>
          <DictationButton
            accessibilityLabel="Start voice input"
            disabled={!canEdit}
            label={dictationLabel}
            onBusyChange={onDictationBusyChange}
            onError={(error) => {
              onDictationError?.(error);
              if (!onDictationError)
                Alert.alert("Voice input", errorMessage(error));
            }}
            onTranscript={(transcript) => {
              const next = appendDictationText(valueRef.current, transcript);
              valueRef.current = next;
              onChangeText?.(next);
            }}
          />
        </View>
      </View>
    );
  },
);

VoiceTextArea.displayName = "VoiceTextArea";
