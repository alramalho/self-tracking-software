import { prisma } from "@/utils/prisma";
import type { Prisma } from "@tsw/prisma";
import { scoreSleep, SLEEP_ALGORITHM } from "./model";
import type { SleepScore, SleepScoresResponse } from "./types";
const SOURCE = "__tracking_sleep_v0__";

export async function updateSleepScoresForProvider(
  userId: string,
  provider = "apple_health",
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext('tracking-sleep-v0'))`;
      const samples = await tx.healthSleepSample.findMany({
        where: { userId, provider, deletedAt: null },
        orderBy: { startAt: "asc" },
      });
      const scores = scoreSleep(samples);
      await tx.healthDailyMetric.deleteMany({
        where: {
          userId,
          provider,
          metric: "sleep_score",
          sourceBundleId: SOURCE,
        },
      });
      if (scores.length)
        await tx.healthDailyMetric.createMany({
          data: scores.map((score) => ({
            userId,
            provider,
            metric: "sleep_score",
            aggregation: "most_recent",
            sourceBundleId: SOURCE,
            sourceName: "tracking.so estimate",
            localDate: score.date,
            value: score.total ?? 0,
            unit: "score",
            timezone: score.timezone,
            // Incomplete totals are null in metadata; never expose placeholder zero.
            metadata: score as unknown as Prisma.InputJsonValue,
          })),
        });
    },
    { timeout: 30_000 },
  );
}

export async function updateSleepScores(userId: string): Promise<void> {
  return updateSleepScoresForProvider(userId, "apple_health");
}

export async function getSleepScoresForProvider(
  userId: string,
  provider = "apple_health",
  days = 180,
): Promise<SleepScoresResponse> {
  const safeDays = Math.min(Math.max(Math.floor(days), 1), 366);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - safeDays + 1);
  const rows = await prisma.healthDailyMetric.findMany({
    where: {
      userId,
      provider,
      metric: "sleep_score",
      sourceBundleId: SOURCE,
      localDate: { gte: cutoff.toISOString().slice(0, 10) },
    },
    orderBy: { localDate: "desc" },
  });
  return {
    metric: "sleep_score",
    name: "Sleep score",
    scale: 100,
    algorithm: SLEEP_ALGORITHM,
    scores: rows.map((row) => row.metadata as unknown as SleepScore),
  };
}

export async function getSleepScores(
  userId: string,
  days = 180,
): Promise<SleepScoresResponse> {
  return getSleepScoresForProvider(userId, "apple_health", days);
}
