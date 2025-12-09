-- Add imageUrls to plan_sessions for AI-generated reference images (exercises, poses, techniques)
ALTER TABLE "public"."plan_sessions" ADD COLUMN "imageUrls" TEXT[] DEFAULT '{}';
