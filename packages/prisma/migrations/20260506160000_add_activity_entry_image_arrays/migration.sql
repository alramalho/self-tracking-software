ALTER TABLE "public"."activity_entries"
  ADD COLUMN IF NOT EXISTS "imageS3Paths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "public"."activity_entries"
SET
  "imageS3Paths" = CASE
    WHEN "imageS3Path" IS NOT NULL AND array_length("imageS3Paths", 1) IS NULL THEN ARRAY["imageS3Path"]::TEXT[]
    ELSE "imageS3Paths"
  END,
  "imageUrls" = CASE
    WHEN "imageUrl" IS NOT NULL AND array_length("imageUrls", 1) IS NULL THEN ARRAY["imageUrl"]::TEXT[]
    ELSE "imageUrls"
  END;
