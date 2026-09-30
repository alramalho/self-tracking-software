-- Coached plan design: what the coach understood (orientation, goal spec, baseline, outline),
-- how far sessions are designed, and structured, measurable session targets. Additive only.
ALTER TABLE "public"."plans"
  ADD COLUMN "orientation" TEXT,
  ADD COLUMN "goalSpec" JSONB,
  ADD COLUMN "baseline" JSONB,
  ADD COLUMN "outline" JSONB,
  ADD COLUMN "designedThrough" DATE;

ALTER TABLE "public"."plan_sessions"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "targets" JSONB;
