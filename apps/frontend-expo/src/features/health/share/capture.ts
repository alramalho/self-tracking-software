import { captureRef, releaseCapture } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import type { ShareWorkoutCardInput } from "./types";

export async function shareWorkoutCard({ view, title }: ShareWorkoutCardInput) {
  if (Platform.OS === "web") throw new Error("Image sharing is available in the iPhone app.");
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is unavailable on this device.");
  const uri = await captureRef(view, {
    format: "png",
    quality: 1,
    // Render the full layer tree at its native bounds. UIKit hierarchy snapshots
    // can omit text inside a clipped/scrolled preview on iOS.
    useRenderInContext: Platform.OS === "ios",
    result: "tmpfile",
  });
  try {
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      UTI: "public.png",
      dialogTitle: title,
    });
  } finally {
    releaseCapture(uri);
  }
}
