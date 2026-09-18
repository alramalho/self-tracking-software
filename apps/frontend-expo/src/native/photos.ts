import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import type { Photo } from "@/core/types";
export async function pickPhotos(camera = false, selectionLimit = 5): Promise<Photo[]> {
  const permission = camera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      camera
        ? "Allow camera access in Settings to take a photo."
        : "Allow photo access in Settings to attach photos.",
    );
  const result = camera
    ? await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit,
        quality: 0.8,
      });
  return result.canceled
    ? []
    : result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `activity-${Date.now()}.jpg`,
        type: a.mimeType ?? "image/jpeg",
        file: a.file,
      }));
}
export async function appendPhotos(
  form: FormData,
  photos: Photo[],
  field = "photos",
) {
  for (const photo of photos) {
    if (Platform.OS === "web") {
      const blob = photo.file ?? (await (await fetch(photo.uri)).blob());
      form.append(field, blob, photo.name);
    } else {
      form.append(field, {
        uri: photo.uri,
        name: photo.name,
        type: photo.type,
      } as unknown as Blob);
    }
  }
}
