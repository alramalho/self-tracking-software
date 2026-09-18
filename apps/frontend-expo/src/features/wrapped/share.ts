import { captureRef, releaseCapture } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import type { ShareStoryInput } from "./types";
export async function shareStory({ view, year }: ShareStoryInput) {
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("Sharing is unavailable on this device.");
  const uri = await captureRef(view, {
    format: "png",
    quality: 1,
    result: "tmpfile",
  });
  try {
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      UTI: "public.png",
      dialogTitle: `My ${year} Wrapped`,
    });
  } finally {
    releaseCapture(uri);
  }
}
