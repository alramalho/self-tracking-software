-- The owner can switch off the coach's posts; each member can mute a circle's pushes.
ALTER TABLE "public"."circles" ADD COLUMN "coachPosts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "public"."circle_members" ADD COLUMN "muted" BOOLEAN NOT NULL DEFAULT false;
