-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PLUS');

-- CreateEnum
CREATE TYPE "ThemeColor" AS ENUM ('RANDOM', 'SLATE', 'BLUE', 'VIOLET', 'AMBER', 'EMERALD', 'ROSE');

-- CreateEnum
CREATE TYPE "ActivityVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'FRIENDS');

-- CreateEnum
CREATE TYPE "DailyCheckinTime" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateEnum
CREATE TYPE "PlanDurationType" AS ENUM ('HABIT', 'LIFESTYLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PlanOutlineType" AS ENUM ('SPECIFIC', 'TIMES_PER_WEEK');

-- CreateEnum
CREATE TYPE "PlanState" AS ENUM ('ON_TRACK', 'AT_RISK', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CriteriaJunction" AS ENUM ('AND', 'OR');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationRecurrence" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSED', 'OPENED', 'CONCLUDED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('FRIEND_REQUEST', 'PLAN_INVITATION', 'ENGAGEMENT', 'INFO', 'METRIC_CHECKIN', 'COACH');

-- CreateEnum
CREATE TYPE "RecommendationObjectType" AS ENUM ('USER');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "profile" TEXT,
    "picture" TEXT,
    "age" INTEGER,
    "username" TEXT,
    "timezone" TEXT DEFAULT 'Europe/Berlin',
    "clerkId" TEXT,
    "language" TEXT DEFAULT 'English',
    "planType" "PlanType" NOT NULL DEFAULT 'FREE',
    "lastActiveAt" TIMESTAMP(3),
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "isPwaInstalled" BOOLEAN NOT NULL DEFAULT false,
    "isPwaNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lookingForAp" BOOLEAN DEFAULT false,
    "pwaSubscriptionEndpoint" TEXT,
    "pwaSubscriptionKey" TEXT,
    "pwaSubscriptionAuthToken" TEXT,
    "unactivatedEmailSentAt" TIMESTAMP(3),
    "themeBaseColor" "ThemeColor" NOT NULL DEFAULT 'BLUE',
    "defaultActivityVisibility" "ActivityVisibility" NOT NULL DEFAULT 'PUBLIC',
    "recommendationsOutdated" BOOLEAN NOT NULL DEFAULT false,
    "recommendationsLastCalculatedAt" TIMESTAMP(3),
    "dailyCheckinDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dailyCheckinTime" "DailyCheckinTime",
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripeSubscriptionStatus" TEXT,
    "referredById" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "measure" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "privacySettings" "ActivityVisibility",
    "colorHex" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_entries" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "deletedAt" TIMESTAMP(3),
    "timezone" TEXT,
    "imageS3Path" TEXT,
    "imageUrl" TEXT,
    "imageExpiresAt" TIMESTAMP(3),
    "imageCreatedAt" TIMESTAMP(3),
    "imageIsPublic" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "activity_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "activityEntryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "activityEntryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "picture" TEXT,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "descriptionSkipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "metric_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planGroupId" TEXT,
    "goal" TEXT NOT NULL,
    "emoji" TEXT,
    "finishingDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "durationType" "PlanDurationType",
    "outlineType" "PlanOutlineType" NOT NULL DEFAULT 'SPECIFIC',
    "timesPerWeek" INTEGER,
    "coachSuggestedTimesPerWeek" INTEGER,
    "notes" TEXT,
    "coachNotes" TEXT,
    "suggestedByCoachAt" TIMESTAMP(3),
    "currentWeekState" "PlanState" NOT NULL DEFAULT 'ON_TRACK',
    "currentWeekStateCalculatedAt" TIMESTAMP(3),

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_sessions" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "isCoachSuggested" BOOLEAN NOT NULL DEFAULT false,
    "activityId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "descriptiveGuide" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_milestones" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "progress" INTEGER,
    "criteria" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_groups" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_invitations" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "plan_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_emotions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "message_emotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "concludedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "recurrence" "NotificationRecurrence",
    "awsCronjobId" TEXT,
    "promptTag" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "relatedId" TEXT,
    "relatedData" JSONB,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recommendationObjectType" "RecommendationObjectType" NOT NULL DEFAULT 'USER',
    "recommendationObjectId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ActivityToPlan" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_PlanGroupToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "connections_fromId_status_idx" ON "connections"("fromId", "status");

-- CreateIndex
CREATE INDEX "connections_toId_status_idx" ON "connections"("toId", "status");

-- CreateIndex
CREATE INDEX "connections_status_idx" ON "connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "connections_fromId_toId_key" ON "connections"("fromId", "toId");

-- CreateIndex
CREATE INDEX "activities_userId_deletedAt_idx" ON "activities"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "activities_deletedAt_privacySettings_idx" ON "activities"("deletedAt", "privacySettings");

-- CreateIndex
CREATE INDEX "activities_createdAt_idx" ON "activities"("createdAt");

-- CreateIndex
CREATE INDEX "activity_entries_userId_deletedAt_idx" ON "activity_entries"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "activity_entries_deletedAt_createdAt_idx" ON "activity_entries"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "activity_entries_activityId_idx" ON "activity_entries"("activityId");

-- CreateIndex
CREATE INDEX "activity_entries_createdAt_idx" ON "activity_entries"("createdAt");

-- CreateIndex
CREATE INDEX "reactions_activityEntryId_idx" ON "reactions"("activityEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_activityEntryId_userId_emoji_key" ON "reactions"("activityEntryId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "comments_activityEntryId_deletedAt_idx" ON "comments"("activityEntryId", "deletedAt");

-- CreateIndex
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");

-- CreateIndex
CREATE INDEX "metrics_userId_idx" ON "metrics"("userId");

-- CreateIndex
CREATE INDEX "metrics_createdAt_idx" ON "metrics"("createdAt");

-- CreateIndex
CREATE INDEX "metric_entries_userId_idx" ON "metric_entries"("userId");

-- CreateIndex
CREATE INDEX "metric_entries_metricId_idx" ON "metric_entries"("metricId");

-- CreateIndex
CREATE INDEX "metric_entries_createdAt_idx" ON "metric_entries"("createdAt");

-- CreateIndex
CREATE INDEX "plans_userId_deletedAt_idx" ON "plans"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "plans_userId_id_idx" ON "plans"("userId", "id");

-- CreateIndex
CREATE INDEX "plans_createdAt_idx" ON "plans"("createdAt");

-- CreateIndex
CREATE INDEX "plan_sessions_planId_idx" ON "plan_sessions"("planId");

-- CreateIndex
CREATE INDEX "plan_sessions_planId_isCoachSuggested_idx" ON "plan_sessions"("planId", "isCoachSuggested");

-- CreateIndex
CREATE INDEX "plan_sessions_activityId_idx" ON "plan_sessions"("activityId");

-- CreateIndex
CREATE INDEX "plan_milestones_planId_idx" ON "plan_milestones"("planId");

-- CreateIndex
CREATE INDEX "messages_userId_idx" ON "messages"("userId");

-- CreateIndex
CREATE INDEX "messages_createdAt_idx" ON "messages"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_ActivityToPlan_AB_unique" ON "_ActivityToPlan"("A", "B");

-- CreateIndex
CREATE INDEX "_ActivityToPlan_B_index" ON "_ActivityToPlan"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PlanGroupToUser_AB_unique" ON "_PlanGroupToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_PlanGroupToUser_B_index" ON "_PlanGroupToUser"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_toId_fkey" FOREIGN KEY ("toId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_activityEntryId_fkey" FOREIGN KEY ("activityEntryId") REFERENCES "activity_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_activityEntryId_fkey" FOREIGN KEY ("activityEntryId") REFERENCES "activity_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_entries" ADD CONSTRAINT "metric_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_entries" ADD CONSTRAINT "metric_entries_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "metrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_planGroupId_fkey" FOREIGN KEY ("planGroupId") REFERENCES "plan_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_sessions" ADD CONSTRAINT "plan_sessions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_sessions" ADD CONSTRAINT "plan_sessions_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_milestones" ADD CONSTRAINT "plan_milestones_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_invitations" ADD CONSTRAINT "plan_invitations_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_invitations" ADD CONSTRAINT "plan_invitations_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_invitations" ADD CONSTRAINT "plan_invitations_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_emotions" ADD CONSTRAINT "message_emotions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActivityToPlan" ADD CONSTRAINT "_ActivityToPlan_A_fkey" FOREIGN KEY ("A") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActivityToPlan" ADD CONSTRAINT "_ActivityToPlan_B_fkey" FOREIGN KEY ("B") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanGroupToUser" ADD CONSTRAINT "_PlanGroupToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "plan_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanGroupToUser" ADD CONSTRAINT "_PlanGroupToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
