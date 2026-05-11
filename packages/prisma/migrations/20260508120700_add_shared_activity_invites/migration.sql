CREATE TYPE "public"."SharedActivityInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE "public"."shared_activity_invites" (
    "id" TEXT NOT NULL,
    "inviterActivityEntryId" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "inviteeUserId" TEXT NOT NULL,
    "status" "public"."SharedActivityInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "shared_activity_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shared_activity_invites_inviterActivityEntryId_inviteeUserId_key" ON "public"."shared_activity_invites"("inviterActivityEntryId", "inviteeUserId");
CREATE INDEX "shared_activity_invites_inviteeUserId_status_idx" ON "public"."shared_activity_invites"("inviteeUserId", "status");
CREATE INDEX "shared_activity_invites_inviterUserId_idx" ON "public"."shared_activity_invites"("inviterUserId");

ALTER TABLE "public"."shared_activity_invites" ADD CONSTRAINT "shared_activity_invites_inviterActivityEntryId_fkey" FOREIGN KEY ("inviterActivityEntryId") REFERENCES "public"."activity_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."shared_activity_invites" ADD CONSTRAINT "shared_activity_invites_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."shared_activity_invites" ADD CONSTRAINT "shared_activity_invites_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
