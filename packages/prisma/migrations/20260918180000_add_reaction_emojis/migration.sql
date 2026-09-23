ALTER TABLE "public"."users"
ADD COLUMN "reactionEmojis" TEXT[] NOT NULL DEFAULT ARRAY['🔥', '🚀', '♥️', '😂', '😮‍💨', '🍑']::TEXT[];
