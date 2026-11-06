import { useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Image,
  Platform,
  Pressable,
  View,
} from "react-native";
import { Camera, CircleCheck, Plus, X } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/typography/Text";
import { Status, useColors } from "@/components/ui";
import { EditorButton } from "@/features/activities/editor/controls";
import { api } from "@/data/api";
import { appendPhotos, pickPhotos } from "@/native/photos";
import type { Photo } from "@/core/types";
import { workoutEndedLabel } from "../workout-model";
import { ReviewLink } from "./controls";
import type { WorkoutPhotoPromptProps } from "./types";

const MAX_PHOTOS = 5;

// Shown right after a just-finished workout is logged: the moment is still
// there to photograph, so the log can carry it.
export function WorkoutPhotoPrompt({
  workout,
  activityEntryId,
  loggedSummary,
  onDone,
}: WorkoutPhotoPromptProps) {
  const c = useColors();
  const client = useQueryClient();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const pick = useMutation({
    mutationFn: (camera: boolean) =>
      pickPhotos(camera, MAX_PHOTOS - photos.length),
    onSuccess: (picked) =>
      setPhotos((current) => [...current, ...picked].slice(0, MAX_PHOTOS)),
  });
  const upload = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      await appendPhotos(form, photos);
      await api.put(
        `/activities/activity-entries/${activityEntryId}/photo`,
        form,
      );
    },
    onSuccess: async () => {
      await Promise.all(
        ["activity-entries", "timeline"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
      onDone();
    },
  });
  const busy = pick.isPending || upload.isPending;

  function chooseSource() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Take Photo", "Photo Library", "Cancel"],
          cancelButtonIndex: 2,
          userInterfaceStyle: c.dark ? "dark" : "light",
        },
        (index) => {
          if (index < 2) pick.mutate(index === 0);
        },
      );
    } else if (Platform.OS === "android") {
      Alert.alert("Add a photo", undefined, [
        { text: "Take Photo", onPress: () => pick.mutate(true) },
        { text: "Photo Library", onPress: () => pick.mutate(false) },
        { text: "Cancel", style: "cancel" },
      ]);
    } else pick.mutate(false);
  }

  return (
    <View testID="workout-photo-prompt" style={{ gap: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <CircleCheck size={20} color={c.accent} strokeWidth={1.8} />
        <Text style={{ flex: 1, color: c.text, fontSize: 15 }}>
          {loggedSummary}
        </Text>
      </View>
      <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21 }}>
        Finished {workoutEndedLabel(workout)}. Snap it while it’s fresh.
      </Text>
      {photos.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                disabled={busy}
                hitSlop={8}
                onPress={() =>
                  setPhotos((current) => current.filter((_, i) => i !== index))
                }
                style={{
                  position: "absolute",
                  right: 4,
                  top: 4,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: `${c.bg}e6`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={15} color={c.text} />
              </Pressable>
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add another photo"
              disabled={busy}
              onPress={chooseSource}
              style={({ pressed }) => ({
                width: "31%",
                aspectRatio: 1,
                borderRadius: 12,
                backgroundColor: c.soft,
                alignItems: "center",
                justifyContent: "center",
                opacity: busy ? 0.5 : pressed ? 0.7 : 1,
              })}
            >
              <Plus size={24} color={c.muted} strokeWidth={1.8} />
            </Pressable>
          )}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take or choose a photo"
          disabled={busy}
          onPress={chooseSource}
          style={({ pressed }) => ({
            minHeight: 148,
            borderRadius: 16,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: c.inputBorder,
            backgroundColor: c.soft,
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            opacity: busy ? 0.5 : pressed ? 0.7 : 1,
          })}
        >
          <Camera size={34} color={c.muted} strokeWidth={1.6} />
          <Text style={{ color: c.muted, fontSize: 14 }}>
            Take or choose a photo
          </Text>
        </Pressable>
      )}
      <Status error={pick.error ?? upload.error} />
      <View style={{ gap: 4 }}>
        {!!photos.length && (
          <EditorButton
            label={
              photos.length > 1 ? `Add ${photos.length} photos` : "Add photo"
            }
            icon={Camera}
            busy={upload.isPending}
            disabled={pick.isPending}
            onPress={() => upload.mutate()}
          />
        )}
        <ReviewLink label="Not now" disabled={busy} onPress={onDone} />
      </View>
    </View>
  );
}
