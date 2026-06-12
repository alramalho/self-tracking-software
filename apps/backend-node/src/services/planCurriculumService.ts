import { z } from "zod/v4";
import { prisma } from "../utils/prisma";

export const CURRICULUM_MAX_FILES = 100;
export const CURRICULUM_MAX_FILE_BYTES = 200_000;

export const curriculumFileSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(300)
    .regex(/^[\w\-. /()\[\]]+$/, "Path contains unsupported characters")
    .refine(
      (value) => !value.includes("..") && !value.startsWith("/"),
      "Path must be relative and must not contain '..'"
    ),
  content: z.string().max(CURRICULUM_MAX_FILE_BYTES),
});

export const curriculumBundleSchema = z.object({
  files: z
    .array(curriculumFileSchema)
    .min(1)
    .max(CURRICULUM_MAX_FILES),
});

export type CurriculumFileInput = z.infer<typeof curriculumFileSchema>;

export function findDuplicatePaths(files: CurriculumFileInput[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const file of files) {
    if (seen.has(file.path)) duplicates.add(file.path);
    seen.add(file.path);
  }
  return Array.from(duplicates);
}

// Replace semantics: files not present in the new bundle are removed.
export async function replaceCurriculum(
  planId: string,
  files: CurriculumFileInput[]
): Promise<{ fileCount: number }> {
  await prisma.$transaction([
    prisma.planCurriculumFile.deleteMany({
      where: { planId, path: { notIn: files.map((file) => file.path) } },
    }),
    ...files.map((file) =>
      prisma.planCurriculumFile.upsert({
        where: { planId_path: { planId, path: file.path } },
        create: { planId, path: file.path, content: file.content },
        update: { content: file.content },
      })
    ),
  ]);
  return { fileCount: files.length };
}

// Upsert semantics: existing files not mentioned are kept.
export async function upsertCurriculumFiles(
  planId: string,
  files: CurriculumFileInput[]
): Promise<{ fileCount: number }> {
  await prisma.$transaction(
    files.map((file) =>
      prisma.planCurriculumFile.upsert({
        where: { planId_path: { planId, path: file.path } },
        create: { planId, path: file.path, content: file.content },
        update: { content: file.content },
      })
    )
  );
  return { fileCount: files.length };
}

export async function listCurriculumFiles(planId: string) {
  const files = await prisma.planCurriculumFile.findMany({
    where: { planId },
    select: { path: true, content: true, updatedAt: true },
    orderBy: { path: "asc" },
  });
  return files.map((file) => ({
    path: file.path,
    bytes: Buffer.byteLength(file.content, "utf8"),
    updatedAt: file.updatedAt,
  }));
}

export async function getCurriculumFileCounts(
  planIds: string[]
): Promise<Map<string, number>> {
  if (planIds.length === 0) return new Map();
  const grouped = await prisma.planCurriculumFile.groupBy({
    by: ["planId"],
    where: { planId: { in: planIds } },
    _count: { _all: true },
  });
  return new Map(grouped.map((row) => [row.planId, row._count._all]));
}
