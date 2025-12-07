#!/usr/bin/env tsx

import "dotenv/config";
import { prisma } from "../src/utils/prisma";
import { plansService } from "../src/services/plansService";

function parseArgs() {
  const args = process.argv.slice(2);
  let userId: string | undefined;
  let username: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--user-id" && args[i + 1]) {
      userId = args[i + 1];
      i++;
    } else if (args[i] === "--username" && args[i + 1]) {
      username = args[i + 1];
      i++;
    }
  }

  return { userId, username };
}

async function recalculateUserProgress() {
  const { userId, username } = parseArgs();

  if (!userId && !username) {
    console.error("Usage: tsx recalculate_user_progress.ts --user-id <id> | --username <username>");
    process.exit(1);
  }

  console.log("Fetching user...");

  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { username },
  });

  if (!user) {
    console.error(`User not found: ${userId || username}`);
    process.exit(1);
  }

  console.log(`User: ${user.username} (id: ${user.id}, timezone: ${user.timezone})`);

  const now = new Date();
  const plans = await prisma.plan.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      OR: [
        { finishingDate: null },
        { finishingDate: { gt: now } },
      ],
    },
    include: { activities: true },
  });

  console.log(`Found ${plans.length} active plans\n`);

  for (const plan of plans) {
    console.log(`\n--- Plan: "${plan.goal}" (${plan.timesPerWeek}x/week) ---`);

    // Force fresh calculation (bypasses cache)
    const progress = await plansService.computePlanProgress(plan, user);

    console.log("Achievement:", {
      streak: progress.achievement.streak,
      completedWeeks: progress.achievement.completedWeeks,
      incompleteWeeks: progress.achievement.incompleteWeeks,
      totalWeeks: progress.achievement.totalWeeks,
    });

    // Filter to only past/current weeks
    const currentWeekStart = new Date();
    currentWeekStart.setUTCHours(0, 0, 0, 0);
    currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - currentWeekStart.getUTCDay());

    const pastWeeks = progress.weeks.filter(
      (w: any) => new Date(w.startDate) <= currentWeekStart
    );

    console.log(`\nLast 6 weeks (of ${pastWeeks.length} total):`);

    for (const week of pastWeeks.slice(-6)) {
      const completedDays = new Set(
        week.completedActivities.map((a: any) =>
          new Date(a.datetime).toISOString().split("T")[0]
        )
      ).size;

      const planned =
        typeof week.plannedActivities === "number"
          ? week.plannedActivities
          : week.plannedActivities.length;

      const weekDate = new Date(week.startDate).toISOString().split("T")[0];
      console.log(
        `  ${weekDate}: ${completedDays}/${planned} days ${week.isCompleted ? "✓" : "✗"}`
      );
    }
  }

  console.log("\n--- Done ---");
  await prisma.$disconnect();
}

recalculateUserProgress().catch((err) => {
  console.error(err);
  process.exit(1);
});
