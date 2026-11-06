import { onlyImages } from "@tsw/prisma/media";
import sharp from "sharp";
import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import { s3Service } from "../s3Service";

interface PhotoEntry {
  id: string;
  imagePreview: string | null;
  imageS3Paths: string[];
  imageS3Path: string | null;
  imageUrls: string[];
  imageUrl: string | null;
}

// A 12 px wide, blurred JPEG as a data URI (a few hundred bytes). People browsing
// circles they aren't in see these instead of the real photos.
export async function blurredPreview(image: Buffer): Promise<string> {
  const jpeg = await sharp(image)
    .rotate()
    .resize(12, 12, { fit: "cover" })
    .blur(1.2)
    .jpeg({ quality: 50 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function sourceUrl(entry: PhotoEntry): Promise<string | null> {
  // Videos and voice notes share this list; only a photo can be blurred.
  const key = onlyImages([...entry.imageS3Paths, ...(entry.imageS3Path ? [entry.imageS3Path] : [])])[0];
  if (key) return s3Service.generatePresignedUrl(key, 120);
  return onlyImages([...entry.imageUrls, ...(entry.imageUrl ? [entry.imageUrl] : [])])[0] ?? null;
}

// Returns the cached preview, creating it on first use. Failures just mean no square.
export async function previewFor(entry: PhotoEntry): Promise<string | null> {
  if (entry.imagePreview) return entry.imagePreview;
  try {
    const url = await sourceUrl(entry);
    if (!url) return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const preview = await blurredPreview(Buffer.from(await response.arrayBuffer()));
    await prisma.activityEntry.update({
      where: { id: entry.id },
      data: { imagePreview: preview },
    });
    return preview;
  } catch (error) {
    logger.warn("Could not make a circle photo preview", { entryId: entry.id, error });
    return null;
  }
}
