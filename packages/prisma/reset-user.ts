import { PrismaClient } from "./index";

const prisma = new PrismaClient();

const isDevelopment = () => process.env.NODE_ENV === 'development';

async function resetUser(username: string) {
  console.info(`Resetting user data for username: ${username}`);

  try {
    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        activities: {
          include: {
            entries: true,
          },
        },
        plans: {
          include: {
            sessions: true,
            milestones: true,
            invitations: true,
          },
        },
        metrics: {
          include: {
            entries: true,
          },
        },
      },
    });

    if (!user) {
      console.error(`User with username "${username}" not found`);
      return;
    }

    console.info(`Found user: ${user.name} (${user.email})`);

    // Start transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Delete plan-related data
      for (const plan of user.plans) {
        console.info(`Deleting plan: ${plan.goal}`);
        
        // Delete plan sessions
        await tx.planSession.deleteMany({
          where: { planId: plan.id },
        });
        console.info(`  - Deleted ${plan.sessions.length} plan sessions`);

        // Delete plan milestones
        await tx.planMilestone.deleteMany({
          where: { planId: plan.id },
        });
        console.info(`  - Deleted ${plan.milestones.length} plan milestones`);

        // Delete plan invitations (both sent and received)
        await tx.planInvitation.deleteMany({
          where: { 
            OR: [
              { planId: plan.id },
              { senderId: user.id },
              { recipientId: user.id },
            ]
          },
        });
        console.info(`  - Deleted ${plan.invitations.length} plan invitations`);
      }

      // Delete plans themselves
      await tx.plan.deleteMany({
        where: { userId: user.id },
      });
      console.info(`Deleted ${user.plans.length} plans`);

      // Delete activity-related data
      for (const activity of user.activities) {
        console.info(`Deleting activity: ${activity.title}`);

        // For each activity entry, delete reactions and comments first
        for (const entry of activity.entries) {
          await tx.reaction.deleteMany({
            where: { activityEntryId: entry.id },
          });
          
          await tx.comment.deleteMany({
            where: { activityEntryId: entry.id },
          });
        }

        // Delete activity entries
        await tx.activityEntry.deleteMany({
          where: { activityId: activity.id },
        });
        console.info(`  - Deleted ${activity.entries.length} activity entries with reactions and comments`);
      }

      // Delete activities themselves
      await tx.activity.deleteMany({
        where: { userId: user.id },
      });
      console.info(`Deleted ${user.activities.length} activities`);

      // Delete metric-related data
      for (const metric of user.metrics) {
        console.info(`Deleting metric: ${metric.title}`);

        // Delete metric entries
        await tx.metricEntry.deleteMany({
          where: { metricId: metric.id },
        });
        console.info(`  - Deleted ${metric.entries.length} metric entries`);
      }

      // Delete metrics themselves
      await tx.metric.deleteMany({
        where: { userId: user.id },
      });
      console.info(`Deleted ${user.metrics.length} metrics`);

      // Also delete any remaining activity entries and metric entries that might reference the user
      await tx.activityEntry.deleteMany({
        where: { userId: user.id },
      });

      await tx.metricEntry.deleteMany({
        where: { userId: user.id },
      });

      // Delete any remaining reactions by this user
      await tx.reaction.deleteMany({
        where: { userId: user.id },
      });

      console.info(`Successfully reset all plans and activities for user: ${user.name}`);
    });

    // Verify deletion
    const updatedUser = await prisma.user.findUnique({
      where: { username },
      include: {
        activities: true,
        plans: true,
        metrics: true,
        activityEntries: true,
        metricEntries: true,
      },
    });

    if (updatedUser) {
      console.info("\nVerification:");
      console.info(`  - Activities: ${updatedUser.activities.length}`);
      console.info(`  - Plans: ${updatedUser.plans.length}`);
      console.info(`  - Metrics: ${updatedUser.metrics.length}`);
      console.info(`  - Activity entries: ${updatedUser.activityEntries.length}`);
      console.info(`  - Metric entries: ${updatedUser.metricEntries.length}`);
    }

    console.info("Reset completed successfully! 🎉");
  } catch (error) {
    console.error("Error resetting user data:", error);
    throw error;
  }
}

async function main() {
  if (!isDevelopment()) {
    console.error(
      "This script is only available in the development environment."
    );
    process.exit(1);
  }

  const username = process.argv[2];
  
  if (!username) {
    console.error("Usage: tsx reset-user.ts <username>");
    console.error("Example: tsx reset-user.ts alex");
    process.exit(1);
  }

  try {
    await resetUser(username);
  } catch (error) {
    console.error("Error running reset-user script:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { resetUser };