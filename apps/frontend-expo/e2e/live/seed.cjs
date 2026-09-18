const {
  backendRequire,
  backendEnv,
  testEmail,
  databaseUrl,
  root,
} = require("./environment.cjs");
const path = require("node:path");
process.env.CLERK_SECRET_KEY = backendEnv.CLERK_SECRET_KEY;
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = databaseUrl;
const url = new URL(databaseUrl);
if (
  url.hostname !== "127.0.0.1" ||
  url.port !== "55432" ||
  url.pathname !== "/tracking_expo_e2e"
)
  throw new Error(
    "Live E2E seeding is restricted to the isolated local test database.",
  );
const { clerkClient } = backendRequire("@clerk/express");
const { PrismaClient } = require(
  path.join(root, "packages/prisma/generated/prisma"),
);
const prisma = new PrismaClient();
async function seed() {
  if (!testEmail)
    throw new Error(
      "Configure APP_TEST_USER_EMAIL from the existing E2E setup.",
    );
  const matches = await clerkClient.users.getUserList({
    emailAddress: [testEmail],
  });
  const clerkUser = matches.data[0];
  if (!clerkUser)
    throw new Error(
      "Existing E2E user was not found in the configured Clerk application.",
    );
  await prisma.user.deleteMany({ where: { id: "expo-live-user" } });
  await prisma.user.deleteMany({ where: { id: "expo-live-friend" } });
  const user = await prisma.user.create({
    data: {
      id: "expo-live-user",
      clerkId: clerkUser.id,
      email: testEmail,
      name: "Expo E2E",
      username: "expo-e2e",
      planType: "PLUS",
      themeMode: "LIGHT",
      themeBaseColor: "BLUE",
      timezone: "Europe/Berlin",
      onboardingCompletedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      id: "expo-live-friend",
      clerkId: "local-only-friend",
      email: "expo-friend@example.invalid",
      name: "Sam",
      username: "expo-friend",
      onboardingCompletedAt: new Date(),
    },
  });
  await prisma.connection.create({
    data: { fromId: user.id, toId: "expo-live-friend", status: "ACCEPTED" },
  });
  await prisma.activity.createMany({
    data: [
      {
        id: "expo-live-run",
        userId: user.id,
        title: "Running",
        emoji: "🏃",
        measure: "kilometers",
        kind: "running",
        colorHex: "#3b82f6",
      },
      {
        id: "expo-live-read",
        userId: user.id,
        title: "Reading",
        emoji: "📚",
        measure: "pages",
        colorHex: "#8b5cf6",
      },
    ],
  });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(8, 0, 0, 0);
  const ago = new Date();
  ago.setDate(ago.getDate() - 28);
  await prisma.activityEntry.createMany({
    data: [
      {
        id: "expo-live-entry",
        userId: user.id,
        activityId: "expo-live-run",
        quantity: 5,
        datetime: yesterday,
        description: "Previous run",
        timezone: "Europe/Berlin",
      },
      {
        id: "expo-live-reading",
        userId: user.id,
        activityId: "expo-live-read",
        quantity: 20,
        datetime: yesterday,
        description: "A good chapter",
        timezone: "Europe/Berlin",
      },
    ],
  });
  await prisma.plan.create({
    data: {
      id: "expo-live-plan",
      userId: user.id,
      goal: "Exercise regularly",
      emoji: "💪",
      outlineType: "TIMES_PER_WEEK",
      durationType: "LIFESTYLE",
      timesPerWeek: 3,
      visibility: "PUBLIC",
      createdAt: ago,
      activities: {
        connect: [{ id: "expo-live-run" }, { id: "expo-live-read" }],
      },
      milestones: {
        create: {
          id: "expo-live-milestone",
          description: "Build a routine",
          date: new Date(),
          progress: 20,
        },
      },
    },
  });
  await prisma.metric.createMany({
    data: [
      { id: "expo-live-energy", userId: user.id, title: "Energy", emoji: "⚡" },
      { id: "expo-live-mood", userId: user.id, title: "Mood", emoji: "😊" },
    ],
  });
  await prisma.metricEntry.createMany({
    data: Array.from({ length: 14 }, (_, i) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - i - 1);
      date.setUTCHours(0, 0, 0, 0);
      return {
        userId: user.id,
        metricId: "expo-live-energy",
        rating: (i % 5) + 1,
        createdAt: date,
      };
    }),
  });
  console.log("Isolated database seeded for the existing Clerk E2E account.");
}
seed()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error.message);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
