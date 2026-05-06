export interface ActivityEntryImageFields {
  imageUrl?: string | null;
  imageS3Path?: string | null;
  imageUrls?: string[] | null;
  imageS3Paths?: string[] | null;
}

export interface UploadedActivityEntryImage {
  url: string;
  s3Path: string;
}

const uniqueTruthy = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => !!value)));

export const getActivityEntryImageUrls = (entry: ActivityEntryImageFields) =>
  uniqueTruthy([...(entry.imageUrls || []), entry.imageUrl]);

export const getActivityEntryImageS3Paths = (entry: ActivityEntryImageFields) =>
  uniqueTruthy([...(entry.imageS3Paths || []), entry.imageS3Path]);

export const buildActivityEntryImageUpdate = (
  existingEntry: ActivityEntryImageFields,
  uploadedImages: UploadedActivityEntryImage[],
  isPublic?: boolean
) => {
  const imageUrls = uniqueTruthy([
    ...getActivityEntryImageUrls(existingEntry),
    ...uploadedImages.map((image) => image.url),
  ]);
  const imageS3Paths = uniqueTruthy([
    ...getActivityEntryImageS3Paths(existingEntry),
    ...uploadedImages.map((image) => image.s3Path),
  ]);

  return {
    imageS3Path: imageS3Paths[0] || null,
    imageUrl: imageUrls[0] || null,
    imageS3Paths,
    imageUrls,
    imageExpiresAt: null,
    imageCreatedAt: new Date(),
    ...(typeof isPublic === "boolean" ? { imageIsPublic: isPublic } : {}),
  };
};
