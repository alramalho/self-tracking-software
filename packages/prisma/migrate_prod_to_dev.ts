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

  return new Set(columns.map((col) => col.column_name));
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
    "message_feedback",
    "message_emotions",
    "recommendations",
    "notifications",
    "messages",
    "chats",
    "plan_invite_links",
    "plan_group_members",
    "plan_milestones",
    "plan_sessions",
    "plans",
    "coaches",
    "connections",
    "comments",
    "reactions",
    "activity_entries",
    "metric_entries",
    "activities",
    "metrics",
    "users",
    "plan_groups",
    "job_runs",
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
    const sourceUserColumns = await getTableColumns(sourcePrisma, "users");
    const targetUserColumns = await getTableColumns(targetPrisma, "users");

    // Build select object to only fetch columns that exist in source database
    const sourceUserSelect = buildSelectForExistingColumns(sourceUserColumns);

    const users = await sourcePrisma.user.findMany({
      select: sourceUserSelect as any,
    });

    // First pass: Upsert all users without referral relationships
    for (const user of users) {
      const { id, referredById, ...userData } = user;

      // Filter userData to only include fields that exist in both source and target
      const commonColumns = new Set(
        [...sourceUserColumns].filter((col) => targetUserColumns.has(col))
      );
      const filteredData = filterToExistingColumns(userData, commonColumns);

      await targetPrisma.user.upsert({
        where: { id },
        create: {
          id,
          ...filteredData,
          ...(commonColumns.has("referredById") ? { referredById: null } : {}), // Will be updated in second pass
        } as any,
        update: {
          ...filteredData,
          ...(commonColumns.has("referredById") ? { referredById: null } : {}), // Will be updated in second pass
        } as any,
      });
    }

    // Second pass: Update referral relationships (only if the field exists)
    if (targetUserColumns.has("referredById")) {
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
    const planGroups = await sourcePrisma.planGroup.findMany();

    for (const planGroup of planGroups) {
      const { id, ...planGroupData } = planGroup;
      await targetPrisma.planGroup.upsert({
        where: { id },
        create: {
          id,
          ...planGroupData,
        },
        update: {
          ...planGroupData,
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

    // Step 5b: Migrate Coaches
    console.info("Migrating coaches...");
    const coaches = await sourcePrisma.coach.findMany();

    for (const coach of coaches) {
      const { id, ...coachData } = coach;
      await targetPrisma.coach.upsert({
        where: { id },
        create: {
          id,
          ...coachData,
          details: coach.details as any, // Handle JsonValue type
        },
        update: {
          ...coachData,
          details: coach.details as any, // Handle JsonValue type
        },
      });
    }
    console.info(`Migrated ${coaches.length} coaches`);

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

    // Step 12: Migrate Plan Group Members
    console.info("Migrating plan group members...");
    const planGroupMembers = await sourcePrisma.planGroupMember.findMany();

    for (const member of planGroupMembers) {
      const { id, ...memberData } = member;
      await targetPrisma.planGroupMember.upsert({
        where: { id },
        create: {
          id,
          ...memberData,
        },
        update: {
          ...memberData,
        },
      });
    }
    console.info(`Migrated ${planGroupMembers.length} plan group members`);

    // Step 12b: Migrate Plan Invite Links
    console.info("Migrating plan invite links...");
    const planInviteLinks = await sourcePrisma.planInviteLink.findMany();

    for (const inviteLink of planInviteLinks) {
      const { id, ...inviteLinkData } = inviteLink;
      await targetPrisma.planInviteLink.upsert({
        where: { id },
        create: {
          id,
          ...inviteLinkData,
        },
        update: {
          ...inviteLinkData,
        },
      });
    }
    console.info(`Migrated ${planInviteLinks.length} plan invite links`);

    // Step 13: Migrate Reactions
    console.info("Migrating reactions...");

    // Get actual columns from both databases
    const sourceReactionColumns = await getTableColumns(sourcePrisma, "reactions");
    const targetReactionColumns = await getTableColumns(targetPrisma, "reactions");

    // Build select object to only fetch columns that exist in source database
    const sourceReactionSelect = buildSelectForExistingColumns(sourceReactionColumns);

    const reactions = await sourcePrisma.reaction.findMany({
      select: sourceReactionSelect as any,
    });

    for (const reaction of reactions) {
      const { id, ...reactionData } = reaction;

      // Filter reactionData to only include fields that exist in both source and target
      const commonColumns = new Set(
        [...sourceReactionColumns].filter((col) => targetReactionColumns.has(col))
      );
      const filteredData = filterToExistingColumns(reactionData, commonColumns);

      await targetPrisma.reaction.upsert({
        where: { id },
        create: {
          id,
          ...filteredData,
        } as any,
        update: {
          ...filteredData,
        } as any,
      });
    }
    console.info(`Migrated ${reactions.length} reactions`);

    // Step 14: Migrate Comments
    console.info("Migrating comments...");

    // Get actual columns from both databases
    const sourceCommentColumns = await getTableColumns(sourcePrisma, "comments");
    const targetCommentColumns = await getTableColumns(targetPrisma, "comments");

    // Build select object to only fetch columns that exist in source database
    const sourceCommentSelect = buildSelectForExistingColumns(sourceCommentColumns);

    const comments = await sourcePrisma.comment.findMany({
      select: sourceCommentSelect as any,
    });
    let migratedComments = 0;
    let skippedComments = 0;

    for (const comment of comments) {
      try {
        const { id, ...commentData } = comment;

        // Filter commentData to only include fields that exist in both source and target
        const commonColumns = new Set(
          [...sourceCommentColumns].filter((col) => targetCommentColumns.has(col))
        );
        const filteredData = filterToExistingColumns(commentData, commonColumns);

        await targetPrisma.comment.upsert({
          where: { id },
          create: {
            id,
            ...filteredData,
          } as any,
          update: {
            ...filteredData,
          } as any,
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

    // Step 14b: Migrate Chats
    console.info("Migrating chats...");

    // Get actual columns from both databases
    const sourceChatColumns = await getTableColumns(sourcePrisma, "chats");
    const targetChatColumns = await getTableColumns(targetPrisma, "chats");

    // Build select object to only fetch columns that exist in source database
    const sourceChatSelect = buildSelectForExistingColumns(sourceChatColumns);

    const chats = await sourcePrisma.chat.findMany({
      select: sourceChatSelect as any,
    });

    for (const chat of chats) {
      const { id, ...chatData } = chat;

      // Filter chatData to only include fields that exist in both source and target
      const commonColumns = new Set(
        [...sourceChatColumns].filter((col) => targetChatColumns.has(col))
      );
      const filteredData = filterToExistingColumns(chatData, commonColumns);

      await targetPrisma.chat.upsert({
        where: { id },
        create: {
          id,
          ...filteredData,
        } as any,
        update: {
          ...filteredData,
        } as any,
      });
    }
    console.info(`Migrated ${chats.length} chats`);

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

    console.info("Migrating feedback...");
    const feedbacks = await sourcePrisma.feedback.findMany();

    for (const feedback of feedbacks) {
      const { id, ...feedbackData } = feedback;
      await targetPrisma.feedback.upsert({
        where: { id },
        create: {
          id,
          ...feedbackData,
          metadata: feedback.metadata as any, // Handle JsonValue type
        },
        update: {
          ...feedbackData,
          metadata: feedback.metadata as any, // Handle JsonValue type
        },
      });
    }
    console.info(`Migrated ${feedbacks.length} feedback entries`);

    // Step 19: Migrate Job Runs
    console.info("Migrating job runs...");
    const jobRuns = await sourcePrisma.jobRun.findMany();

    for (const jobRun of jobRuns) {
      const { id, ...jobRunData } = jobRun;
      await targetPrisma.jobRun.upsert({
        where: { id },
        create: {
          id,
          ...jobRunData,
          input: jobRun.input as any, // Handle JsonValue type
          output: jobRun.output as any, // Handle JsonValue type
        },
        update: {
          ...jobRunData,
          input: jobRun.input as any, // Handle JsonValue type
          output: jobRun.output as any, // Handle JsonValue type
        },
      });
    }
    console.info(`Migrated ${jobRuns.length} job runs`);

    // Post-processing: Impersonate user by swapping supabaseAuthId
    const { impersonateUser } = parseArgs();
    console.info(
      `Post-processing: Setting up impersonation for ${impersonateUser}...`
    );

    // Find your user (the one you'll log in as)
    const myUser = await targetPrisma.user.findUnique({
      where: { email: "alexandre.ramalho.1998@gmail.com" },
    });

    // Find the target user to impersonate
    const targetUser = await targetPrisma.user.findUnique({
      where: { username: impersonateUser },
    });

    if (targetUser && myUser) {
      const myOriginalAuthId = myUser.supabaseAuthId;
      const targetOriginalAuthId = targetUser.supabaseAuthId;

      // Swap the supabaseAuthId values
      // Your user gets a placeholder auth ID
      await targetPrisma.user.update({
        where: { id: myUser.id },
        data: {
          supabaseAuthId: `--impersonating-${impersonateUser}--`,
        },
      });

      // Target user gets your auth ID (so when you log in, you become them)
      await targetPrisma.user.update({
        where: { id: targetUser.id },
        data: {
          supabaseAuthId: myOriginalAuthId,
        },
      });

      console.info(
        `✅ Impersonation set up: logging in with alexandre.ramalho.1998@gmail.com will impersonate ${impersonateUser}`
      );
    } else {
      console.warn(
        `⚠️  User with email 'alexandre.ramalho.1998@gmail.com' or username '${impersonateUser}' not found, could not set up impersonation.`
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
