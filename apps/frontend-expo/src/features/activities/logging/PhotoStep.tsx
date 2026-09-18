import { useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  View,
} from "react-native";
import { ArrowLeft, Camera, ChevronDown, Info, X } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import { VoiceTextArea } from "@/features/dictation/VoiceTextArea";
import type { PhotoStepProps } from "./types";

export function PhotoStep({
  photos,
  caption,
  busy,
  picking,
  uploadProgress,
  onCaptionChange,
  onAddPhotos,
  onRemovePhoto,
  onSave,
  onBack,
  children,
}: PhotoStepProps) {
  const c = useColors();
  const [options, setOptions] = useState(false);
  const disabled = busy || picking;
  function chooseSource() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Photo Library", "Take Photo", "Cancel"],
          cancelButtonIndex: 2,
          userInterfaceStyle: c.dark ? "dark" : "light",
        },
        (index) => {
          if (index < 2) onAddPhotos(index === 1);
        },
      );
    } else if (Platform.OS === "android") {
      Alert.alert("Add photos", undefined, [
        { text: "Photo Library", onPress: () => onAddPhotos() },
        { text: "Take Photo", onPress: () => onAddPhotos(true) },
        { text: "Cancel", style: "cancel" },
      ]);
    } else onAddPhotos();
  }
  const label = busy
    ? photos.length && uploadProgress != null && uploadProgress < 100
      ? `Uploading ${photos.length} photo${photos.length === 1 ? "" : "s"}… ${uploadProgress}%`
      : "Saving activity…"
    : photos.length
      ? `Upload ${photos.length} photo${photos.length === 1 ? "" : "s"}`
      : "Log without photo";
  return (
    <View testID="activity-photo-step" style={{ gap: 16 }}>
      <View
        style={{
          alignSelf: "center",
          width: photos.length ? "100%" : 200,
          maxWidth: 304,
          gap: 12,
        }}
      >
        {!!photos.length && (
          <View
            testID="selected-activity-photos"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
          >
            {photos.map((photo, index) => (
              <View
                key={`${photo.uri}-${index}`}
                style={{ width: "31%", aspectRatio: 1 }}
              >
                <Image
                  accessibilityLabel={`Selected photo ${index + 1}`}
                  source={{ uri: photo.uri }}
                  style={{ width: "100%", height: "100%", borderRadius: 12 }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  disabled={disabled}
                  onPress={() => onRemovePhoto(index)}
                  hitSlop={8}
                  style={{
                    position: "absolute",
                    right: 2,
                    top: 2,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: `${c.bg}e6`,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <X size={16} color={c.text} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {photos.length < 10 && (
          <Pressable
            testID="activity-photo-upload-tile"
            accessibilityRole="button"
            accessibilityLabel={
              photos.length
                ? `Add more photos (${photos.length}/10)`
                : "Add photos (optional)"
            }
            disabled={disabled}
            onPress={chooseSource}
            style={({ pressed }) => ({
              padding: 16,
              minHeight: 104,
              borderRadius: 12,
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: c.border,
              backgroundColor: c.soft,
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
            })}
          >
            {picking ? (
              <ActivityIndicator color={c.muted} />
            ) : (
              <Camera size={32} color={c.muted} strokeWidth={1.8} />
            )}
            <Text style={{ fontSize: 14, color: c.muted, textAlign: "center" }}>
              {picking
                ? "Processing images…"
                : photos.length
                  ? `Add more photos (${photos.length}/10)`
                  : "Add photos (optional)"}
            </Text>
          </Pressable>
        )}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: c.text }}>
          Caption (optional)
        </Text>
        <VoiceTextArea
          testID="field-Caption"
          accessibilityLabel="Caption (optional)"
          placeholder="Add a caption for this log..."
          placeholderTextColor={c.muted}
          value={caption}
          onChangeText={onCaptionChange}
          editable={!disabled}
          textAlignVertical="top"
          dictationLabel="caption"
          style={{
            minHeight: 120,
            maxHeight: 200,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: c.inputBorder,
            backgroundColor: c.soft,
            borderRadius: 12,
            fontSize: 16,
            fontFamily: "Inter-Regular",
            color: c.text,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <Info size={20} color={c.muted} />
        <Text style={{ flex: 1, color: c.muted, fontSize: 14, lineHeight: 21 }}>
          Only you and your friends can see this info until it expires after 7
          days.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onSave}
        style={({ pressed }) => ({
          backgroundColor: c.accent,
          borderRadius: 16,
          minHeight: 48,
          padding: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: disabled ? 0.6 : pressed ? 0.7 : 1,
        })}
      >
        {busy && <ActivityIndicator color="white" />}
        <Text style={{ color: "white", fontSize: 14, fontWeight: "600" }}>
          {label}
        </Text>
      </Pressable>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          disabled={disabled}
          onPress={onBack}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            minHeight: 44,
          }}
        >
          <ArrowLeft size={16} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 13 }}>Back</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More options"
          accessibilityState={{ expanded: options }}
          disabled={disabled}
          onPress={() => setOptions(!options)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            minHeight: 44,
          }}
        >
          <Text style={{ color: c.muted, fontSize: 13 }}>More options</Text>
          <ChevronDown
            size={16}
            color={c.muted}
            style={{ transform: [{ rotate: options ? "180deg" : "0deg" }] }}
          />
        </Pressable>
      </View>
      {options && children}
    </View>
  );
}
