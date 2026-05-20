#!/usr/bin/env tsx

import "dotenv/config";
import { PrismaClient } from "@tsw/prisma";
import { scoreSharedActivityCandidate } from "../src/utils/sharedActivities";

const prisma = new PrismaClient();

async function main() {
  const alexId = "670fb420158ba86def604e67";
  const liaId = "67122237238e1560e7c2b6cc";

  const alexEntry = await prisma.activityEntry.findFirst({
    where: { id: "cmpcunei000033rnvk2uhx107" },
    include: { activity: true, sharedActivityEntry: true },
  });

  const liaEntry = await prisma.activityEntry.findFirst({
    where: { id: "cmpb52yfh005rms1740mnz68f" },
    include: { activity: true, sharedActivityEntry: true },
  });

  console.log("=== Entries ===");
  console.log("Alex:", {
    title: alexEntry!.activity!.title,
    kind: alexEntry!.activity!.kind,
    dt: alexEntry!.datetime,
    lat: alexEntry!.latitude,
    lng: alexEntry!.longitude,
    hasShared: !!alexEntry!.sharedActivityEntry,
  });
  console.log("Lia:", {
    title: liaEntry!.activity!.title,
    kind: liaEntry!.activity!.kind,
    dt: liaEntry!.datetime,
    lat: liaEntry!.latitude,
    lng: liaEntry!.longitude,
    hasShared: !!liaEntry!.sharedActivityEntry,
  });

  // 1. Connection check
  const conn = await prisma.connection.findFirst({
    where: {
      OR: [
        { fromId: alexId, toId: liaId },
        { fromId: liaId, toId: alexId },
      ],
    },
  });
  console.log("\n=== Connection ===");
  console.log("Status:", conn?.status ?? "NONE");

  // 2. Visibility check
  const liaActivities = await prisma.activity.findMany({
    where: { userId: liaId, deletedAt: null },
    select: { id: true, title: true },
  });
  const liaPlans = await prisma.plan.findMany({
    where: { userId: liaId, deletedAt: null },
    select: { visibility: true, activities: { select: { id: true } } },
  });
  const publicIds = new Set<string>();
  const allPlannedIds = new Set<string>();
  liaPlans.forEach((p) => {
    p.activities.forEach((a) => {
      allPlannedIds.add(a.id);
      if (p.visibility === "PUBLIC") publicIds.add(a.id);
    });
  });
  const visibleIds = new Set(
    liaActivities
      .filter((a) => publicIds.has(a.id) || !allPlannedIds.has(a.id))
      .map((a) => a.id)
  );
  console.log(
    "\n=== Visibility ===",
    "\nLia activityId:",
    liaEntry!.activityId,
    "visible:",
    visibleIds.has(liaEntry!.activityId!)
  );

  // 3. Day window query
  const dayStart = new Date(alexEntry!.datetime);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(alexEntry!.datetime);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const rawCandidates = await prisma.activityEntry.findMany({
    where: {
      userId: { in: [liaId] },
      deletedAt: null,
      activityId: { in: Array.from(visibleIds) },
      datetime: { gte: dayStart, lte: dayEnd },
      sharedActivityEntry: null,
    },
    include: { activity: true },
    take: 20,
  });

  console.log("\n=== DB Query ===");
  console.log("Day range:", dayStart.toISOString(), "->", dayEnd.toISOString());
  console.log("Raw candidates:", rawCandidates.length);
  rawCandidates.forEach((c) =>
    console.log("  ", c.id, c.activity!.title, c.datetime)
  );

  // 4. Score
  console.log("\n=== Scoring ===");
  for (const c of rawCandidates) {
    const score = scoreSharedActivityCandidate({
      sourceTitle: alexEntry!.activity!.title,
      sourceMeasure: alexEntry!.activity!.measure,
      sourceEmoji: alexEntry!.activity!.emoji,
      sourceDatetime: alexEntry!.datetime,
      sourceKind: alexEntry!.activity!.kind as any,
      sourceLatitude: alexEntry!.latitude,
      sourceLongitude: alexEntry!.longitude,
      candidateTitle: c.activity!.title,
      candidateMeasure: c.activity!.measure,
      candidateEmoji: c.activity!.emoji,
      candidateDatetime: c.datetime,
      candidateKind: c.activity!.kind as any,
      candidateLatitude: c.latitude,
      candidateLongitude: c.longitude,
    });
    console.log(
      "  ",
      c.activity!.title,
      "-> score:",
      score,
      score >= 50 ? "MATCH" : "NO MATCH"
    );
  }

  await prisma.$disconnect();
}

main();
