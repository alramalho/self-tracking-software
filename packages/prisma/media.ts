// Activity entries keep photos, videos and voice notes in one list of URLs
// (imageUrls). The file extension tells them apart.

export type MediaKind = "image" | "video" | "audio";

const videoExtensions = ["mp4", "mov", "m4v", "webm"];
const audioExtensions = ["m4a", "aac", "mp3", "wav", "caf", "ogg", "opus"];

function extensionOf(url: string) {
  return url.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
}

export function mediaKind(url: string): MediaKind {
  const extension = extensionOf(url);
  if (videoExtensions.includes(extension)) return "video";
  if (audioExtensions.includes(extension)) return "audio";
  return "image";
}

export function mediaKindOfMimeType(type: string): MediaKind {
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "image";
}

export function onlyImages(urls: string[]) {
  return urls.filter((url) => mediaKind(url) === "image");
}

const extensionsByMimeType: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-caf": "caf",
  "image/png": "png",
  "image/heic": "heic",
  "image/webp": "webp",
};

// The stored extension decides how a file is shown, so it must match its type.
export function mediaExtension(fileName: string | undefined, mimeType: string) {
  const fromName = fileName?.includes(".") ? extensionOf(fileName) : "";
  if (fromName && mediaKind(`x.${fromName}`) === mediaKindOfMimeType(mimeType))
    return fromName;
  return extensionsByMimeType[mimeType] ?? (mediaKindOfMimeType(mimeType) === "video" ? "mp4" : mediaKindOfMimeType(mimeType) === "audio" ? "m4a" : "jpg");
}

export function describeMedia(urls: string[]) {
  const kinds = new Set(urls.map(mediaKind));
  if (kinds.size !== 1) return "photos and clips";
  const kind = [...kinds][0];
  const many = urls.length > 1;
  if (kind === "video") return many ? "videos" : "a video";
  if (kind === "audio") return many ? "voice notes" : "a voice note";
  return many ? "photos" : "a photo";
}
