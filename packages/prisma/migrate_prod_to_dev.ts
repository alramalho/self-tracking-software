import * as readline from "readline";
import { PrismaClient } from "./generated/prisma";

// Parse command line arguments
function parseArgs(): { impersonateUser: string } {
  const args = process.argv.slice(2);
  let impersonateUser = "alex"; // default

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--impersonate" && i + 1 < args.length) {
      impersonateUser = args[i + 1];
      break;
    }
  }

  return { impersonateUser };
}

// Source database (production)
const sourcePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PROD_DATABASE_URL,
    },
  },
});

// Target database (development)
const targetPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DEV_DATABASE_URL,
    },
  },
});

const isDevelopment = () => process.env.NODE_ENV === "development";

/**
 * Get actual column names from a database table
 */
async function getTableColumns(
  prismaClient: PrismaClient,
  tableName: string
): Promise<Set<string>> {
  const columns = await prismaClient.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = ${tableName}
    AND table_schema = 'public'
  `;

  return new Set(columns.map(col => col.column_name));
}

/**
 * Filter an object to only include keys that exist as columns in the database
 */
function filterToExistingColumns<T extends Record<string, any>>(
  data: T,
  existingColumns: Set<string>
): Partial<T> {
  const filtered: Partial<T> = {};

  for (const [key, value] of Object.entries(data)) {
    if (existingColumns.has(key)) {
      filtered[key as keyof T] = value;
    }
  }

  return filtered;
}

/**
 * Build a Prisma select object that only includes fields that exist in the database
 */
function buildSelectForExistingColumns(
  existingColumns: Set<string>
): Record<string, boolean> {
  const select: Record<string, boolean> = {};

  for (const column of existingColumns) {
    select[column] = true;
  }

  return select;
}

function maskDatabaseUrl(url: string): string {
  if (!url) return "undefined";
  // Keep only the protocol, host, and database name visible
  const urlParts = url.match(
    /^(postgresql:\/\/)([^:]+:[^@]+@)?([^\/]+)\/(.+)$/
  );
  if (urlParts) {
    const [, protocol, credentials, host, dbName] = urlParts;
    const maskedCredentials = credentials ? "***:***@" : "";
    return `${protocol}${maskedCredentials}${host}/${dbName}`;
  }
  return url.substring(0, 20) + "...";
}

async function confirmMigration(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n⚠️  DATABASE MIGRATION WARNING ⚠️");
  console.log("=====================================\n");

  console.log("This operation will:");
  console.log("1. ❌ COMPLETELY WIPE the target database");
  console.log("2. 📋 Copy ALL data from production to development");
  console.log("3. 🔄 This action CANNOT be undone\n");

  console.log(
    "Source (PROD):  ",
    maskDatabaseUrl(process.env.PROD_DATABASE_URL!)
  );
  console.log(
    "Target (DEV):   ",
    maskDatabaseUrl(process.env.DEV_DATABASE_URL!)
  );
  console.log(
    "\n⚠️  ALL DATA in the DEV database will be PERMANENTLY DELETED!\n"
  );

  return new Promise((resolve) => {
    rl.question('Type "CONFIRM" to proceed with the migration: ', (answer) => {
      rl.close();
      resolve(answer.trim() === "CONFIRM");
    });
  });
}

async function clearTargetDatabase() {
  console.info("Clearing target database...");

  // Clear in reverse dependency order to avoid foreign key constraints
  const tables = [
    "message_emotions",
    "recommendations",
    "notifications",
    "messages",
    "plan_invitations",
    "plan_milestones",
    "plan_sessions",
    "plans",
    "connections",
    "comments",
    "reactions",
    "activity_entries",
    "metric_entries",
    "activities",
    "metrics",
    "users",
    "plan_groups",
  ];

  for (const table of tables) {
    try {
      await targetPrisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
      console.info(`Cleared ${table}`);
    } catch (error) {
      console.warn(`Could not clear ${table}:`, error);
    }
  }
}

async function migrateData() {
  console.info("Starting data migration from PROD to DEV...");

  try {
    // Step 1: Clear target database
    await clearTargetDatabase();

    // Step 2: Migrate Users (including referral relationships)
    console.info("Migrating users...");

    // Get actual columns from both databases
    const sourceUserColumns = await getTableColumns(sourcePrisma, 'users');
    const targetUserColumns = await getTableColumns(targetPrisma, 'users');

    // Build select object to only fetch columns that exist in source database
    const sourceUserSelect = buildSelectForExistingColumns(sourceUserColumns);

    const users = await sourcePrisma.user.findMany({
      select: sourceUserSelect as any,
    });

    // First pass: Upsert all users without referral relationships
    for (const user of users) {
      const { id, referredById, ...userData } = user;

      // Filter userData to only include fields that exist in both source and target
      const commonColumns = new Set([...sourceUserColumns].filter(col => targetUserColumns.has(col)));
      const filteredData = filterToExistingColumns(userData, commonColumns);

      await targetPrisma.user.upsert({
        where: { id },
        create: {
          id,
          ...filteredData,
          ...(commonColumns.has('referredById') ? { referredById: null } : {}), // Will be updated in second pass
        } as any,
        update: {
          ...filteredData,
          ...(commonColumns.has('referredById') ? { referredById: null } : {}), // Will be updated in second pass
        } as any,
      });
    }

    // Second pass: Update referral relationships (only if the field exists)
    if (targetUserColumns.has('referredById')) {
      for (const user of users) {
        if ((user as any).referredById) {
          await targetPrisma.user.update({
            where: { id },
            data: { referredById: (user as any).referredById },
          });
        }
      }
    }

    console.info(`Migrated ${users.length} users`);

    // Step 3: Migrate PlanGroups
    console.info("Migrating plan groups...");
    const planGroups = await sourcePrisma.planGroup.findMany({
      include: { members: true },
    });

    for (const planGroup of planGroups) {
      const { id, members, ...planGroupData } = planGroup;
      await targetPrisma.planGroup.upsert({
        where: { id },
        create: {
          id,
          ...planGroupData,
          members: {
            connect: members.map((member) => ({ id: member.id })),
          },
        },
        update: {
          ...planGroupData,
          members: {
            set: members.map((member) => ({ id: member.id })),
          },
        },
      });
    }
    console.info(`Migrated ${planGroups.length} plan groups`);

    // Step 4: Migrate Activities
    console.info("Migrating activities...");
    const activities = await sourcePrisma.activity.findMany();

    for (const activity of activities) {
      const { id, ...activityData } = activity;
      await targetPrisma.activity.upsert({
        where: { id },
        create: {
          id,
          ...activityData,
        },
        update: {
          ...activityData,
        },
      });
    }
    console.info(`Migrated ${activities.length} activities`);

    // Step 5: Migrate Metrics
    console.info("Migrating metrics...");
    const metrics = await sourcePrisma.metric.findMany();

    for (const metric of metrics) {
      const { id, ...metricData } = metric;
      await targetPrisma.metric.upsert({
        where: { id },
        create: {
          id,
          ...metricData,
        },
        update: {
          ...metricData,
        },
      });
    }
    console.info(`Migrated ${metrics.length} metrics`);

    // Step 6: Migrate Plans
    console.info("Migrating plans...");
    const plans = await sourcePrisma.plan.findMany({
      include: { activities: true },
    });

    for (const plan of plans) {
      const { id, activities: planActivities, ...planData } = plan;
      await targetPrisma.plan.upsert({
        where: { id },
        create: {
          id,
          ...planData,
          progressState: plan.progressState as any, // Handle JsonValue type
          activities: {
            connect: planActivities.map((activity) => ({
              id: activity.id,
            })),
          },
        },
        update: {
          ...planData,
          progressState: plan.progressState as any, // Handle JsonValue type
          activities: {
            set: planActivities.map((activity) => ({
              id: activity.id,
            })),
          },
        },
      });
    }
    console.info(`Migrated ${plans.length} plans`);

    // Step 7: Migrate Activity Entries
    console.info("Migrating activity entries...");
    const activityEntries = await sourcePrisma.activityEntry.findMany();

    for (const entry of activityEntries) {
      const { id, ...entryData } = entry;
      await targetPrisma.activityEntry.upsert({
        where: { id },
        create: {
          id,
          ...entryData,
        },
        update: {
          ...entryData,
        },
      });
    }
    console.info(`Migrated ${activityEntries.length} activity entries`);

    // Step 8: Migrate Metric Entries
    console.info("Migrating metric entries...");
    const metricEntries = await sourcePrisma.metricEntry.findMany();

    for (const entry of metricEntries) {
      const { id, ...entryData } = entry;
      await targetPrisma.metricEntry.upsert({
        where: { id },
        create: {
          id,
          ...entryData,
        },
        update: {
          ...entryData,
        },
      });
    }
    console.info(`Migrated ${metricEntries.length} metric entries`);

    // Step 9: Migrate Plan Sessions
    console.info("Migrating plan sessions...");
    const planSessions = await sourcePrisma.planSession.findMany();

    for (const session of planSessions) {
      const { id, ...sessionData } = session;
      await targetPrisma.planSession.upsert({
        where: { id },
        create: {
          id,
          ...sessionData,
        },
        update: {
          ...sessionData,
        },
      });
    }
    console.info(`Migrated ${planSessions.length} plan sessions`);

    // Step 10: Migrate Plan Milestones
    console.info("Migrating plan milestones...");
    const planMilestones = await sourcePrisma.planMilestone.findMany();

    for (const milestone of planMilestones) {
      const { id, ...milestoneData } = milestone;
      await targetPrisma.planMilestone.upsert({
        where: { id },
        create: {
          id,
          ...milestoneData,
          criteria: milestone.criteria as any, // Handle JsonValue type
        },
        update: {
          ...milestoneData,
          criteria: milestone.criteria as any, // Handle JsonValue type
        },
      });
    }
    console.info(`Migrated ${planMilestones.length} plan milestones`);

    // Step 11: Migrate Connections
    console.info("Migrating connections...");
    const connections = await sourcePrisma.connection.findMany();

    for (const connection of connections) {
      const { id, ...connectionData } = connection;
      await targetPrisma.connection.upsert({
        where: { id },
        create: {
          id,
          ...connectionData,
        },
        update: {
          ...connectionData,
        },
      });
    }
    console.info(`Migrated ${connections.length} connections`);

    // Step 12: Migrate Plan Invitations
    console.info("Migrating plan invitations...");
    const planInvitations = await sourcePrisma.planInvitation.findMany();

    for (const invitation of planInvitations) {
      const { id, ...invitationData } = invitation;
      await targetPrisma.planInvitation.upsert({
        where: { id },
        create: {
          id,
          ...invitationData,
        },
        update: {
          ...invitationData,
        },
      });
    }
    console.info(`Migrated ${planInvitations.length} plan invitations`);

    // Step 13: Migrate Reactions
    console.info("Migrating reactions...");
    const reactions = await sourcePrisma.reaction.findMany();

    for (const reaction of reactions) {
      const { id, ...reactionData } = reaction;
      await targetPrisma.reaction.upsert({
        where: { id },
        create: {
          id,
          ...reactionData,
        },
        update: {
          ...reactionData,
        },
      });
    }
    console.info(`Migrated ${reactions.length} reactions`);

    // Step 14: Migrate Comments
    console.info("Migrating comments...");
    const comments = await sourcePrisma.comment.findMany();
    let migratedComments = 0;
    let skippedComments = 0;

    for (const comment of comments) {
      try {
        const { id, ...commentData } = comment;
        await targetPrisma.comment.upsert({
          where: { id },
          create: {
            id,
            ...commentData,
          },
          update: {
            ...commentData,
          },
        });
        migratedComments++;
      } catch (error) {
        console.warn(
          `Skipping comment ${comment.id} due to constraint violation:`,
          error instanceof Error ? error.message : String(error)
        );
        skippedComments++;
      }
    }
    console.info(
      `Migrated ${migratedComments} comments, skipped ${skippedComments} due to constraint violations`
    );

    // Step 15: Migrate Messages
    console.info("Migrating messages...");
    const messages = await sourcePrisma.message.findMany({
      include: { emotions: true },
    });

    for (const message of messages) {
      const { id, emotions, ...messageData } = message;
      await targetPrisma.message.upsert({
        where: { id },
        create: {
          id,
          ...messageData,
        },
        update: {
          ...messageData,
        },
      });

      // Migrate message emotions
      for (const emotion of emotions) {
        const { id: emotionId, ...emotionData } = emotion;
        await targetPrisma.messageEmotion.upsert({
          where: { id: emotionId },
          create: {
            id: emotionId,
            ...emotionData,
            messageId: message.id,
          },
          update: {
            ...emotionData,
            messageId: message.id,
          },
        });
      }
    }
    console.info(`Migrated ${messages.length} messages`);

    // Step 16: Migrate Notifications
    console.info("Migrating notifications...");
    const notifications = await sourcePrisma.notification.findMany();

    for (const notification of notifications) {
      const { id, ...notificationData } = notification;
      await targetPrisma.notification.upsert({
        where: { id },
        create: {
          id,
          ...notificationData,
          relatedData: notification.relatedData as any, // Handle JsonValue type
        },
        update: {
          ...notificationData,
          relatedData: notification.relatedData as any, // Handle JsonValue type
        },
      });
    }
    console.info(`Migrated ${notifications.length} notifications`);

    // Step 17: Migrate Recommendations
    console.info("Migrating recommendations...");
    const recommendations = await sourcePrisma.recommendation.findMany();

    for (const recommendation of recommendations) {
      const { id, ...recommendationData } = recommendation;
      await targetPrisma.recommendation.upsert({
        where: { id },
        create: {
          id,
          ...recommendationData,
          metadata: recommendation.metadata as any, // Handle JsonValue type
        },
        update: {
          ...recommendationData,
          metadata: recommendation.metadata as any, // Handle JsonValue type
        },
      });
    }
    console.info(`Migrated ${recommendations.length} recommendations`);

    // Post-processing: Update specified user with specific Clerk ID
    const { impersonateUser } = parseArgs();
    console.info(
      `Post-processing: Updating ${impersonateUser} user with Clerk ID...`
    );
    const alexUser = await targetPrisma.user.findUnique({
      where: { username: "alex" },
    });
    const targetUser = await targetPrisma.user.findUnique({
      where: { username: impersonateUser },
    });

    if (targetUser && alexUser) {
      await targetPrisma.user.update({
        where: { id: alexUser.id },
        data: {
          clerkId: `--impersonating-${impersonateUser}--`,
          supabaseAuthId: `--impersonating-${impersonateUser}--`,
        },
      });
      await targetPrisma.user.update({
        where: { id: targetUser.id },
        data: {
          clerkId: "user_30bDMTLDj4WYYD4h7VpYoQm9gAD",
          supabaseAuthId: "30e57a1b-2913-4d13-836f-a2b7c5b74bb7",
        },
      });
      console.info(`✅ Impersonated ${impersonateUser} user.`);
    } else {
      console.warn(
        `⚠️  User with username 'alex' or '${impersonateUser}' not found, could not impersonate.`
      );
    }

    console.info("Migration completed successfully! 🎉");
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  }
}

async function main() {
  if (!process.env.PROD_DATABASE_URL) {
    console.error("PROD_DATABASE_URL environment variable is required");
    process.exit(1);
  }

  if (!process.env.DEV_DATABASE_URL) {
    console.error("DEV_DATABASE_URL environment variable is required");
    process.exit(1);
  }

  if (!isDevelopment()) {
    console.error("This script should only be run in development environment");
    process.exit(1);
  }

  // Show confirmation prompt
  const confirmed = await confirmMigration();
  if (!confirmed) {
    console.log("\n❌ Migration cancelled by user.");
    process.exit(0);
  }

  console.log("\n✅ Migration confirmed. Starting data transfer...\n");

  try {
    await migrateData();
  } catch (error) {
    console.error("Error running migration script:", error);
    process.exit(1);
  } finally {
    await sourcePrisma.$disconnect();
    await targetPrisma.$disconnect();
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { migrateData };
