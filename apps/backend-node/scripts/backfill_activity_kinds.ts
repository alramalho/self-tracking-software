#!/usr/bin/env tsx

import dotenv from "dotenv";
if (process.argv.includes("--prod")) {
  dotenv.config({ path: ".env.prod", override: true });
}
dotenv.config();

import { classifyAndUpdateActivityKind } from "../src/services/activityCategorizationService";
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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const activities = await prisma.activity.findMany({
    where: {
      deletedAt: null,
      ...(userId ? { userId } : {}),
      ...(onlyMissing ? { kind: "other" } : {}),
      entries: { some: { datetime: { gte: thirtyDaysAgo }, deletedAt: null } },
    },
    select: {
      id: true,
      title: true,
      measure: true,
      emoji: true,
      kind: true,
    },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  const total = activities.length;
  console.log(`Backfilling ${total} activities (users active in last 30d)\n`);

  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let processed = 0;

  function renderProgress() {
    const pct = total === 0 ? 100 : Math.round((processed / total) * 100);
    const barWidth = 30;
    const filled = Math.round((pct / 100) * barWidth);
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
    process.stdout.write(
      `\r  ${bar} ${pct}%  (${processed}/${total})  ✓${updated} =${unchanged} ✗${failed}`
    );
  }

  renderProgress();

  const results = await Promise.allSettled(
    activities.map(async (activity) => {
      const kind = await classifyAndUpdateActivityKind(activity);
      const changed = kind !== activity.kind;
      processed++;
      renderProgress();
      return changed;
    })
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      result.value ? updated++ : unchanged++;
    } else {
      failed++;
    }
  }

  process.stdout.write("\n\n");
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
