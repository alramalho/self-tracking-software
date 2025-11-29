import { PrismaClient } from "./index";

const prisma = new PrismaClient();

// Helper function to check if we're in development
const isDevelopment = () => true; //() => process.env.NODE_ENV === 'development'

async function deleteAllData() {
  if (!isDevelopment()) {
    console.error(
      "This script is only available in the development environment."
    );
    return;
  }

  console.info("Cleaning all data from database...");

  try {
    // Delete in order of dependencies (children first, parents last)
    await prisma.messageEmotion.deleteMany({});
    await prisma.message.deleteMany({});

    await prisma.reaction.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.activityEntry.deleteMany({});

    await prisma.metricEntry.deleteMany({});
    await prisma.metric.deleteMany({});

    await prisma.planMilestone.deleteMany({});

    await prisma.planSession.deleteMany({});

    await prisma.planGroup.deleteMany({});
    await prisma.plan.deleteMany({});

    await prisma.activity.deleteMany({});

    await prisma.connection.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.recommendation.deleteMany({});

    await prisma.user.deleteMany({});

    console.info("Successfully cleaned all data from database");
  } catch (error) {
    console.error("Error deleting data:", error);
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

  try {
    await deleteAllData();
  } catch (error) {
    console.error("Error running seed script:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main();

export { deleteAllData };
