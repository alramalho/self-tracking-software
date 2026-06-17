DROP TABLE IF EXISTS "public"."reminders";

DROP TYPE IF EXISTS "public"."ReminderStatus";
DROP TYPE IF EXISTS "public"."RecurringType";

ALTER TABLE "public"."users"
  DROP COLUMN IF EXISTS "activityRemindersEnabled";
