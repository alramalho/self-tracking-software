-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "iosDeviceToken" TEXT,
ADD COLUMN "iosDeviceTokenUpdatedAt" TIMESTAMP(3);
