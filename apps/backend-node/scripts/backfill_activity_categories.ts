#!/usr/bin/env tsx

import "dotenv/config";
import { classifyAndUpdateActivityCategory } from "../src/services/activityCategorizationService";
import { prisma } from "../src/utils/prisma";

function parseArgs() {
  const args = process.argv.slice(2);
  let userId: string | undefined;
  let limit: number | undefined;
  let onlyMissing = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--user-id" && args[i + 1]) {
      userId = args[i + 1];
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = Number(args[i + 1]);
      i++;
    } else if (args[i] === "--only-missing") {
      onlyMissing = true;
    }
  }

  return { userId, limit, onlyMissing };
}

async function main() {
  const { userId, limit, onlyMissing } = parseArgs();

  const activities = await prisma.activity.findMany({
    where: {
      deletedAt: null,
      ...(userId ? { userId } : {}),
      ...(onlyMissing ? { category: "other" } : {}),
    },
    select: {
      id: true,
      title: true,
      measure: true,
      emoji: true,
      category: true,
    },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Backfilling ${activities.length} activities`);

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const activity of activities) {
    try {
      const category = await classifyAndUpdateActivityCategory(activity);
      if (category === activity.category) {
        unchanged++;
      } else {
        updated++;
      }
      console.log(
        `${activity.id} ${activity.title}: ${activity.category} -> ${category}`
      );
    } catch (error) {
      failed++;
      console.error(`Failed to classify ${activity.id} ${activity.title}`, error);
    }
  }

  console.log(
    `Done. updated=${updated} unchanged=${unchanged} failed=${failed}`
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
