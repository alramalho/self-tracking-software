import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { mediaKindOfMimeType } from "@tsw/prisma/media";
import type { MediaSource, Photo } from "@/core/types";

// A proof clip, not a film: longer videos are refused before they cost an upload.
export const maxVideoSeconds = 60;
// Picked videos are re-encoded on the phone to 960×540 H.264 MP4 and recorded
// ones are captured at 640×480 H.264, a few MB per 10 s: small enough for
// mobile data, sharp enough at feed width, and playable in browsers.
const compressedLibraryVideo = {
  videoExportPreset: ImagePicker.VideoExportPreset.H264_960x540,
  videoMaxDuration: maxVideoSeconds,
};
const compressedRecordedVideo = {
  videoQuality: ImagePicker.UIImagePickerControllerQualityType.VGA640x480,
  videoMaxDuration: maxVideoSeconds,
};

export function mediaKindOf(photo: Pick<Photo, "type">) {
  return mediaKindOfMimeType(photo.type);
}

export async function pickPhotos(camera = false, selectionLimit = 5): Promise<Photo[]> {
  return pickMedia(camera ? "camera" : "library", selectionLimit, false);
}

// Activity logs also accept videos; profile pictures and backgrounds don't.
export async function pickMedia(
  source: MediaSource = "library",
  selectionLimit = 5,
  allowVideo = true,
): Promise<Photo[]> {
  const camera = source !== "library";
  // The iOS photo picker runs outside the app and needs no library access;
  // only the camera asks.
  if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
    throw new Error(`Allow camera access in Settings to take a ${source === "video-camera" ? "video" : "photo"}.`);
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
      : source === "video-camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["videos"], ...compressedRecordedVideo })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: allowVideo ? ["images", "videos"] : ["images"],
            allowsMultipleSelection: true,
            selectionLimit,
            quality: 0.8,
            ...(allowVideo ? compressedLibraryVideo : {}),
          });
  if (result.canceled) return [];
  const tooLong = result.assets.some(
    (a) => a.type === "video" && (a.duration ?? 0) > maxVideoSeconds * 1000 + 500,
  );
  if (tooLong)
    throw new Error(`Videos can be up to ${maxVideoSeconds} seconds. Trim it in Photos and try again.`);
  return result.assets.map((a) => {
    const video = a.type === "video";
    return {
      uri: a.uri,
      name: a.fileName ?? `activity-${Date.now()}.${video ? "mp4" : "jpg"}`,
      type: a.mimeType ?? (video ? "video/mp4" : "image/jpeg"),
      file: a.file,
      durationMs: video ? (a.duration ?? undefined) : undefined,
    };
  });
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
