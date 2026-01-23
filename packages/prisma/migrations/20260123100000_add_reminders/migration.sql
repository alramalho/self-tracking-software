-- Create RecurringType enum
CREATE TYPE "public"."RecurringType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- Create ReminderStatus enum
CREATE TYPE "public"."ReminderStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- Create reminders table
CREATE TABLE "public"."reminders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "triggerAt" TIMESTAMP(3) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringType" "public"."RecurringType",
    "recurringDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "public"."ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "reminders_userId_status_idx" ON "public"."reminders"("userId", "status");
CREATE INDEX "reminders_triggerAt_status_idx" ON "public"."reminders"("triggerAt", "status");

-- Add foreign key constraint
ALTER TABLE "public"."reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
