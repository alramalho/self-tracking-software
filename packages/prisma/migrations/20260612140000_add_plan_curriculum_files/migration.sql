CREATE TABLE "public"."plan_curriculum_files" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "plan_curriculum_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_curriculum_files_planId_path_key" ON "public"."plan_curriculum_files"("planId", "path");

ALTER TABLE "public"."plan_curriculum_files"
ADD CONSTRAINT "plan_curriculum_files_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "public"."plans"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
