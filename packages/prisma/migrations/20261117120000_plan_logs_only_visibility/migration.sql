-- A plan can hide itself while its logs stay visible.
ALTER TYPE "public"."Visibility" ADD VALUE IF NOT EXISTS 'LOGS_ONLY';
