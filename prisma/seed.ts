import { ActivityEntry, MetricEntry, PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

const isDevelopment = () => true; //() => process.env.NODE_ENV === 'development'

async function generateDummyData() {
  console.info("Generating dummy data...");

  try {
    // Create 5 users with predefined IDs for consistency
    const userData = [
      {
        name: "Alex",
        email: "alexandre.ramalho.1998@gmail.com",
        clerkId: "user_30bDMTLDj4WYYD4h7VpYoQm9gAD",
        picture:
          "https://lh3.googleusercontent.com/a/ACg8ocLI9cioxfK2XKVtsArYggis7j9dB7-B7JiwkzMWFsKPeVBQdXlG=s1000-c",
        username: "alex",
      },
      {
        name: "Alice",
        email: "alice@example.com",
        username: "alice",
        lookingForAp: true,
      },
      {
        name: "E2E",
        email: "alexandre.ramalho.1998+e2etracking@gmail.com",
        username: "bamboozle",
        clerkId: "user_2pacar3EWIkXixT3na4OkFAxwb8",
      },
      {
        name: "Charlie",
        email: "charlie@example.com",
        username: "charlie",
        lookingForAp: true,
      },
      {
        name: "Tomas",
        email: "tomas@example.com",
        username: "tomas",
        picture: "https://example.com/tomas.jpg",
      },
    ];

    // Create users
    const users: User[] = [];
    for (const data of userData) {
      const user = await prisma.user.create({ data });
      users.push(user);
    }

    // Create connections (replaces the old friendship system)
    // Alex and E2E are friends (accepted connection)
    await prisma.connection.create({
      data: {
        fromId: users[0].id, // Alex
        toId: users[2].id, // E2E
        status: "ACCEPTED",
      },
    });

    // Alex and Alice are friends (accepted connection)
    await prisma.connection.create({
      data: {
        fromId: users[0].id, // Alex
        toId: users[1].id, // Alice
        status: "ACCEPTED",
      },
    });

    // Set up referral relationship (Alice referred by Alex)
    await prisma.user.update({
      where: { id: users[0].id }, // Alex
      data: {
        referredUsers: { connect: { id: users[1].id } }, // Alice referred by Alex
      },
    });

    // Create metrics - happiness for Alex
    const happinessMetric = await prisma.metric.create({
      data: {
        userId: users[0].id,
        title: "Happiness",
        emoji: "😊",
      },
    });

    // Create activities
    const runningActivity = await prisma.activity.create({
      data: {
        userId: users[0].id,
        title: "Running",
        measure: "kilometers",
        emoji: "🏃",
      },
    });

    const meditationActivity = await prisma.activity.create({
      data: {
        userId: users[0].id,
        title: "Meditation",
        measure: "minutes",
        emoji: "🧘",
      },
    });

    const pushUpsActivity = await prisma.activity.create({
      data: {
        userId: users[2].id, // E2E user
        title: "push-ups",
        measure: "times",
        emoji: "💪",
      },
    });

    // Generate activity and metric entries over 60 days
    const now = new Date();
    const baseDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

    const activityEntries: ActivityEntry[] = [];
    const metricEntries: MetricEntry[] = [];

    for (let i = 0; i < 20; i++) {
      // Space out entries roughly 3 days apart
      const currentDate = new Date(
        baseDate.getTime() + i * 3 * 24 * 60 * 60 * 1000
      );

      // Simulate running on even-numbered entries
      if (i % 2 === 0) {
        const runEntry = await prisma.activityEntry.create({
          data: {
            activityId: runningActivity.id,
            userId: users[0].id,
            quantity: 5,
            date: currentDate,
          },
        });
        activityEntries.push(runEntry);
      }

      // Simulate meditation on odd-numbered entries
      if (i % 2 === 1) {
        const meditationEntry = await prisma.activityEntry.create({
          data: {
            activityId: meditationActivity.id,
            userId: users[0].id,
            quantity: 15,
            date: currentDate,
          },
        });
        activityEntries.push(meditationEntry);
      }

      // Happiness rating - high (4-5) on running days, random (1-5) on non-running days
      const didRun = i % 2 === 0;
      const happinessRating = didRun
        ? Math.floor(Math.random() * 2) + 4 // 4-5
        : Math.floor(Math.random() * 5) + 1; // 1-5

      const metricEntry = await prisma.metricEntry.create({
        data: {
          userId: users[0].id,
          metricId: happinessMetric.id,
          rating: happinessRating,
          date: currentDate,
        },
      });
      metricEntries.push(metricEntry);
    }

    // Create plans
    const finishingDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const marathonPlan = await prisma.plan.create({
      data: {
        userId: users[0].id,
        goal: "Run a marathon",
        emoji: "🏃",
        finishingDate: finishingDate,
        activities: {
          connect: { id: runningActivity.id },
        },
      },
    });

    const meditationPlan = await prisma.plan.create({
      data: {
        userId: users[1].id,
        goal: "Meditate daily",
        emoji: "🧘",
        finishingDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        activities: {
          connect: { id: meditationActivity.id },
        },
      },
    });

    // Connect activities to plans using the new many-to-many relationship
    await prisma.plan.update({
      where: { id: marathonPlan.id },
      data: {
        activities: {
          connect: { id: runningActivity.id },
        },
      },
    });

    await prisma.plan.update({
      where: { id: meditationPlan.id },
      data: {
        activities: {
          connect: { id: meditationActivity.id },
        },
      },
    });

    // Create plan sessions for marathon training (every 3 days for 90 days)
    for (let i = 0; i < 30; i++) {
      const sessionDate = new Date(now.getTime() + i * 3 * 24 * 60 * 60 * 1000);
      await prisma.planSession.create({
        data: {
          planId: marathonPlan.id,
          activityId: runningActivity.id,
          date: sessionDate,
          descriptiveGuide: `Run ${5 + i} km`,
          quantity: 5 + i,
        },
      });
    }

    // Create plan sessions for meditation (daily for 30 days)
    for (let i = 0; i < 30; i++) {
      const sessionDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      await prisma.planSession.create({
        data: {
          planId: meditationPlan.id,
          activityId: meditationActivity.id,
          date: sessionDate,
          descriptiveGuide: "Meditate for 15 minutes",
          quantity: 15,
        },
      });
    }

    // Create plan groups with members
    const marathonPlanGroup = await prisma.planGroup.create({
      data: {
        members: {
          connect: { id: users[0].id },
        },
        plans: {
          connect: { id: marathonPlan.id },
        },
      },
    });

    const meditationPlanGroup = await prisma.planGroup.create({
      data: {
        members: {
          connect: { id: users[1].id },
        },
        plans: {
          connect: { id: meditationPlan.id },
        },
      },
    });

    // Update plans with plan group IDs
    await prisma.plan.update({
      where: { id: marathonPlan.id },
      data: { planGroupId: marathonPlanGroup.id },
    });

    await prisma.plan.update({
      where: { id: meditationPlan.id },
      data: { planGroupId: meditationPlanGroup.id },
    });

    // Create plan invitations
    const planInvitation1 = await prisma.planInvitation.create({
      data: {
        planId: marathonPlan.id,
        senderId: users[0].id,
        recipientId: users[1].id,
      },
    });

    const planInvitation2 = await prisma.planInvitation.create({
      data: {
        planId: meditationPlan.id,
        senderId: users[1].id,
        recipientId: users[2].id,
      },
    });

    // Create pending connection requests (replaces friend requests)
    const connectionRequest1 = await prisma.connection.create({
      data: {
        fromId: users[1].id, // Alice
        toId: users[0].id, // Alex
        status: "PENDING",
        message:
          "Hey Alex! Let's connect and track our fitness goals together! 💪",
      },
    });

    const connectionRequest2 = await prisma.connection.create({
      data: {
        fromId: users[4].id, // Tomas
        toId: users[0].id, // Alex
        status: "PENDING",
        message: "Hi Alex, I'd love to connect!",
      },
    });

    // Create notifications for connection requests
    await prisma.notification.create({
      data: {
        userId: connectionRequest1.toId,
        message: `${users[1].name} sent you a connection request`,
        type: "FRIEND_REQUEST", // Keep the same type for backward compatibility
        relatedId: connectionRequest1.id,
        relatedData: {
          id: users[1].id,
          name: users[1].name,
          username: users[1].username,
          picture: users[1].picture,
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId: connectionRequest2.toId,
        message: `${users[4].name} sent you a connection request`,
        type: "FRIEND_REQUEST", // Keep the same type for backward compatibility
        relatedId: connectionRequest2.id,
        relatedData: {
          id: users[4].id,
          name: users[4].name,
          username: users[4].username,
          picture: users[4].picture,
        },
      },
    });

    // Create notifications for plan invitations
    await prisma.notification.create({
      data: {
        userId: planInvitation1.recipientId,
        message: `${users[0].name} invited you to join the plan: ${marathonPlan.goal}`,
        type: "PLAN_INVITATION",
        relatedId: planInvitation1.id,
        relatedData: {
          id: users[0].id,
          name: users[0].name,
          username: users[0].username,
          picture: users[0].picture,
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId: planInvitation2.recipientId,
        message: `${users[1].name} invited you to join the plan: ${meditationPlan.goal}`,
        type: "PLAN_INVITATION",
        relatedId: planInvitation2.id,
        relatedData: {
          id: users[1].id,
          name: users[1].name,
          username: users[1].username,
          picture: users[1].picture,
        },
      },
    });

    // Create engagement notifications
    await prisma.notification.create({
      data: {
        userId: users[0].id,
        message: "How's your training going? Let's check in on your progress!",
        type: "ENGAGEMENT",
      },
    });

    await prisma.notification.create({
      data: {
        userId: users[0].id,
        message:
          "Time for your weekly reflection! Let's take a moment to look back at your journey. What goals have you accomplished this week? What challenges did you overcome? What have you learned about yourself through tracking your activities and working towards your goals?",
        type: "ENGAGEMENT",
      },
    });

    // Print final state
    console.info("\nFinal state:");
    for (const user of users) {
      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          // Get connections where user is either sender or receiver with ACCEPTED status
          connectionsFrom: {
            where: { status: "ACCEPTED" },
            include: { to: true },
          },
          connectionsTo: {
            where: { status: "ACCEPTED" },
            include: { from: true },
          },
          activities: {
            include: {
              entries: {
                orderBy: { date: "desc" },
                take: 5,
              },
            },
          },
          plans: {
            include: {
              planGroup: {
                include: {
                  members: true,
                },
              },
              sessions: {
                take: 5,
              },
            },
          },
          notifications: {
            where: { concludedAt: null },
          },
        },
      });

      if (!userData) continue;

      // Get all friends from both directions
      const friends = [
        ...userData.connectionsFrom.map((conn) => conn.to),
        ...userData.connectionsTo.map((conn) => conn.from),
      ];

      console.info(`\nUser: ${userData.name} (username: ${userData.username})`);
      console.info(`Friends: ${friends.map((f) => f.name).join(", ")}`);

      const pendingPlanInvitations = await prisma.planInvitation.count({
        where: { recipientId: userData.id, status: "PENDING" },
      });

      const pendingConnectionRequests = await prisma.connection.count({
        where: { toId: userData.id, status: "PENDING" },
      });

      console.info(`Pending Plan Invitations: ${pendingPlanInvitations}`);
      console.info(`Pending Connection Requests: ${pendingConnectionRequests}`);

      console.info("Activities:");
      for (const activity of userData.activities) {
        console.info(`- ${activity.title}`);
        for (const entry of activity.entries) {
          console.info(
            `  * ${entry.date}: ${entry.quantity} ${activity.measure}`
          );
        }
      }

      console.info("Plans:");
      for (const plan of userData.plans) {
        console.info(`- ${plan.goal} (Finishing date: ${plan.finishingDate})`);
        if (plan.planGroup) {
          console.info(
            `  Members: ${plan.planGroup.members.map((m) => m.name).join(", ")}`
          );
        }
        console.info(`  Sessions: ${plan.sessions.length}`);
      }

      console.info("Notifications:");
      for (const notification of userData.notifications) {
        console.info(`- Type: ${notification.type}`);
        console.info(`  Message: ${notification.message}`);
        console.info(`  Status: ${notification.status}`);
      }
    }

    console.info("Done! 🎉");
  } catch (error) {
    console.error("Error generating dummy data:", error);
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
    await generateDummyData();
  } catch (error) {
    console.error("Error running seed script:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { generateDummyData };
