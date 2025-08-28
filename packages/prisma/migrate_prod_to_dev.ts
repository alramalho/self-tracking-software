import { PrismaClient } from "./index";
import * as readline from 'readline';

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

const isDevelopment = () => process.env.NODE_ENV === 'development';

function maskDatabaseUrl(url: string): string {
  if (!url) return 'undefined';
  // Keep only the protocol, host, and database name visible
  const urlParts = url.match(/^(postgresql:\/\/)([^:]+:[^@]+@)?([^\/]+)\/(.+)$/);
  if (urlParts) {
    const [, protocol, credentials, host, dbName] = urlParts;
    const maskedCredentials = credentials ? '***:***@' : '';
    return `${protocol}${maskedCredentials}${host}/${dbName}`;
  }
  return url.substring(0, 20) + '...';
}

async function confirmMigration(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n⚠️  DATABASE MIGRATION WARNING ⚠️');
  console.log('=====================================\n');
  
  console.log('This operation will:');
  console.log('1. ❌ COMPLETELY WIPE the target database');
  console.log('2. 📋 Copy ALL data from production to development');
  console.log('3. 🔄 This action CANNOT be undone\n');
  
  console.log('Source (PROD):  ', maskDatabaseUrl(process.env.PROD_DATABASE_URL!));
  console.log('Target (DEV):   ', maskDatabaseUrl(process.env.DEV_DATABASE_URL!));
  console.log('\n⚠️  ALL DATA in the DEV database will be PERMANENTLY DELETED!\n');

  return new Promise((resolve) => {
    rl.question('Type "CONFIRM" to proceed with the migration: ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'CONFIRM');
    });
  });
}

async function clearTargetDatabase() {
  console.info("Clearing target database...");
  
  // Clear in reverse dependency order to avoid foreign key constraints
  const tables = [
    'message_emotions',
    'recommendations', 
    'notifications',
    'messages',
    'plan_invitations',
    'plan_milestones',
    'plan_sessions',
    'plans',
    'connections',
    'comments',
    'reactions', 
    'activity_entries',
    'metric_entries',
    'activities',
    'metrics',
    'users',
    'plan_groups'
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
    const users = await sourcePrisma.user.findMany({
      include: {
        referredBy: true,
        referredUsers: true,
      }
    });
    
    // First pass: Create all users without referral relationships
    const userIdMap = new Map<string, string>();
    for (const user of users) {
      const { id, referredBy, referredUsers, ...userData } = user;
      const newUser = await targetPrisma.user.create({
        data: {
          ...userData,
          referredById: null, // Will be updated in second pass
        },
      });
      userIdMap.set(id, newUser.id);
    }

    // Second pass: Update referral relationships
    for (const user of users) {
      if (user.referredById && userIdMap.has(user.referredById)) {
        const newUserId = userIdMap.get(user.id)!;
        const newReferredById = userIdMap.get(user.referredById)!;
        
        await targetPrisma.user.update({
          where: { id: newUserId },
          data: { referredById: newReferredById },
        });
      }
    }

    console.info(`Migrated ${users.length} users`);

    // Step 3: Migrate PlanGroups
    console.info("Migrating plan groups...");
    const planGroups = await sourcePrisma.planGroup.findMany({
      include: { members: true }
    });
    
    const planGroupIdMap = new Map<string, string>();
    for (const planGroup of planGroups) {
      const { id, members, ...planGroupData } = planGroup;
      const newPlanGroup = await targetPrisma.planGroup.create({
        data: {
          ...planGroupData,
          members: {
            connect: members.map(member => ({ id: userIdMap.get(member.id)! }))
          }
        },
      });
      planGroupIdMap.set(id, newPlanGroup.id);
    }
    console.info(`Migrated ${planGroups.length} plan groups`);

    // Step 4: Migrate Activities
    console.info("Migrating activities...");
    const activities = await sourcePrisma.activity.findMany();
    const activityIdMap = new Map<string, string>();
    
    for (const activity of activities) {
      const { id, ...activityData } = activity;
      const newActivity = await targetPrisma.activity.create({
        data: {
          ...activityData,
          userId: userIdMap.get(activity.userId)!,
        },
      });
      activityIdMap.set(id, newActivity.id);
    }
    console.info(`Migrated ${activities.length} activities`);

    // Step 5: Migrate Metrics
    console.info("Migrating metrics...");
    const metrics = await sourcePrisma.metric.findMany();
    const metricIdMap = new Map<string, string>();
    
    for (const metric of metrics) {
      const { id, ...metricData } = metric;
      const newMetric = await targetPrisma.metric.create({
        data: {
          ...metricData,
          userId: userIdMap.get(metric.userId)!,
        },
      });
      metricIdMap.set(id, newMetric.id);
    }
    console.info(`Migrated ${metrics.length} metrics`);

    // Step 6: Migrate Plans
    console.info("Migrating plans...");
    const plans = await sourcePrisma.plan.findMany({
      include: { activities: true }
    });
    const planIdMap = new Map<string, string>();
    
    for (const plan of plans) {
      const { id, activities: planActivities, ...planData } = plan;
      const newPlan = await targetPrisma.plan.create({
        data: {
          ...planData,
          userId: userIdMap.get(plan.userId)!,
          planGroupId: plan.planGroupId ? planGroupIdMap.get(plan.planGroupId)! : null,
          activities: {
            connect: planActivities.map(activity => ({ id: activityIdMap.get(activity.id)! }))
          }
        },
      });
      planIdMap.set(id, newPlan.id);
    }
    console.info(`Migrated ${plans.length} plans`);

    // Step 7: Migrate Activity Entries
    console.info("Migrating activity entries...");
    const activityEntries = await sourcePrisma.activityEntry.findMany();
    const activityEntryIdMap = new Map<string, string>();
    
    for (const entry of activityEntries) {
      const { id, ...entryData } = entry;
      const newEntry = await targetPrisma.activityEntry.create({
        data: {
          ...entryData,
          userId: userIdMap.get(entry.userId)!,
          activityId: activityIdMap.get(entry.activityId)!,
        },
      });
      activityEntryIdMap.set(id, newEntry.id);
    }
    console.info(`Migrated ${activityEntries.length} activity entries`);

    // Step 8: Migrate Metric Entries
    console.info("Migrating metric entries...");
    const metricEntries = await sourcePrisma.metricEntry.findMany();
    
    for (const entry of metricEntries) {
      const { id, ...entryData } = entry;
      await targetPrisma.metricEntry.create({
        data: {
          ...entryData,
          userId: userIdMap.get(entry.userId)!,
          metricId: metricIdMap.get(entry.metricId)!,
        },
      });
    }
    console.info(`Migrated ${metricEntries.length} metric entries`);

    // Step 9: Migrate Plan Sessions
    console.info("Migrating plan sessions...");
    const planSessions = await sourcePrisma.planSession.findMany();
    
    for (const session of planSessions) {
      const { id, ...sessionData } = session;
      await targetPrisma.planSession.create({
        data: {
          ...sessionData,
          planId: planIdMap.get(session.planId)!,
          activityId: activityIdMap.get(session.activityId)!,
        },
      });
    }
    console.info(`Migrated ${planSessions.length} plan sessions`);

    // Step 10: Migrate Plan Milestones
    console.info("Migrating plan milestones...");
    const planMilestones = await sourcePrisma.planMilestone.findMany();
    
    for (const milestone of planMilestones) {
      const { id, planId, ...milestoneData } = milestone;
      await targetPrisma.planMilestone.create({
        data: {
          ...milestoneData,
          planId: planIdMap.get(planId)!,
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
      await targetPrisma.connection.create({
        data: {
          ...connectionData,
          fromId: userIdMap.get(connection.fromId)!,
          toId: userIdMap.get(connection.toId)!,
        },
      });
    }
    console.info(`Migrated ${connections.length} connections`);

    // Step 12: Migrate Plan Invitations
    console.info("Migrating plan invitations...");
    const planInvitations = await sourcePrisma.planInvitation.findMany();
    const planInvitationIdMap = new Map<string, string>();
    
    for (const invitation of planInvitations) {
      const { id, ...invitationData } = invitation;
      const newInvitation = await targetPrisma.planInvitation.create({
        data: {
          ...invitationData,
          planId: planIdMap.get(invitation.planId)!,
          senderId: userIdMap.get(invitation.senderId)!,
          recipientId: userIdMap.get(invitation.recipientId)!,
        },
      });
      planInvitationIdMap.set(id, newInvitation.id);
    }
    console.info(`Migrated ${planInvitations.length} plan invitations`);

    // Step 13: Migrate Reactions
    console.info("Migrating reactions...");
    const reactions = await sourcePrisma.reaction.findMany();
    
    for (const reaction of reactions) {
      const { id, ...reactionData } = reaction;
      await targetPrisma.reaction.create({
        data: {
          ...reactionData,
          userId: userIdMap.get(reaction.userId)!,
          activityEntryId: activityEntryIdMap.get(reaction.activityEntryId)!,
        },
      });
    }
    console.info(`Migrated ${reactions.length} reactions`);

    // Step 14: Migrate Comments
    console.info("Migrating comments...");
    const comments = await sourcePrisma.comment.findMany();
    
    for (const comment of comments) {
      const { id, ...commentData } = comment;
      await targetPrisma.comment.create({
        data: {
          ...commentData,
          activityEntryId: activityEntryIdMap.get(comment.activityEntryId)!,
        },
      });
    }
    console.info(`Migrated ${comments.length} comments`);

    // Step 15: Migrate Messages
    console.info("Migrating messages...");
    const messages = await sourcePrisma.message.findMany({
      include: { emotions: true }
    });
    const messageIdMap = new Map<string, string>();
    
    for (const message of messages) {
      const { id, emotions, ...messageData } = message;
      const newMessage = await targetPrisma.message.create({
        data: {
          ...messageData,
          userId: userIdMap.get(message.userId)!,
        },
      });
      messageIdMap.set(id, newMessage.id);

      // Migrate message emotions
      for (const emotion of emotions) {
        const { id: emotionId, ...emotionData } = emotion;
        await targetPrisma.messageEmotion.create({
          data: {
            ...emotionData,
            messageId: newMessage.id,
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
      await targetPrisma.notification.create({
        data: {
          ...notificationData,
          userId: userIdMap.get(notification.userId)!,
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
      await targetPrisma.recommendation.create({
        data: {
          ...recommendationData,
          userId: userIdMap.get(recommendation.userId)!,
          metadata: recommendation.metadata as any, // Handle JsonValue type
        },
      });
    }
    console.info(`Migrated ${recommendations.length} recommendations`);

    // Post-processing: Update alex user with specific Clerk ID
    console.info("Post-processing: Updating alex user with Clerk ID...");
    const alexUser = await targetPrisma.user.findUnique({
      where: { username: "alex" }
    });
    
    if (alexUser) {
      await targetPrisma.user.update({
        where: { id: alexUser.id },
        data: {
          clerkId: "user_30bDMTLDj4WYYD4h7VpYoQm9gAD"
        }
      });
      console.info("✅ Updated alex user with Clerk ID: user_30bDMTLDj4WYYD4h7VpYoQm9gAD");
    } else {
      console.warn("⚠️  User with username 'alex' not found - skipping Clerk ID update");
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
    console.log('\n❌ Migration cancelled by user.');
    process.exit(0);
  }

  console.log('\n✅ Migration confirmed. Starting data transfer...\n');

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