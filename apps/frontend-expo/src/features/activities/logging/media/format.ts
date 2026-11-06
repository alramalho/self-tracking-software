import { mediaKindOfMimeType, type MediaKind } from "@tsw/prisma/media";
import type { Photo } from "@/core/types";

export function clockDuration(millis: number) {
  const seconds = Math.max(0, Math.round(millis / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const nouns: Record<MediaKind, [string, string]> = {
  image: ["photo", "photos"],
  video: ["video", "videos"],
  audio: ["voice note", "voice notes"],
};

// "2 photos, 1 video" — what the upload button is about to send.
export function describeSelection(media: Photo[]) {
  const counts = new Map<MediaKind, number>();
  for (const item of media) {
    const kind = mediaKindOfMimeType(item.type);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts]
    .map(([kind, count]) => `${count} ${nouns[kind][count === 1 ? 0 : 1]}`)
    .join(", ");
}
