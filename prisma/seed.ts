import { ActivityEntry, MetricEntry, PrismaClient, User, } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to check if we're in development
const isDevelopment = () => true//() => process.env.NODE_ENV === 'development'

console.log('NODE_ENV', process.env.NODE_ENV);
async function deleteAllData() {
  if (!isDevelopment()) {
    console.error('This script is only available in the development environment.');
    return;
  }

  console.info('Cleaning all data from database...');

  try {
    // Delete in order of dependencies (children first, parents last)
    await prisma.messageEmotion.deleteMany({});
    await prisma.message.deleteMany({});
    
    await prisma.reaction.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.activityEntry.deleteMany({});
    
    await prisma.metricEntry.deleteMany({});
    await prisma.metric.deleteMany({});
    
    await prisma.planMilestoneCriteria.deleteMany({});
    await prisma.planMilestoneCriteriaGroup.deleteMany({});
    await prisma.planMilestone.deleteMany({});
    
    await prisma.planSession.deleteMany({});
    await prisma.planActivity.deleteMany({});
    await prisma.planInvitation.deleteMany({});
    
    await prisma.planGroupMember.deleteMany({});
    await prisma.planGroup.deleteMany({});
    await prisma.plan.deleteMany({});
    
    await prisma.activity.deleteMany({});
    
    await prisma.friendRequest.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.recommendation.deleteMany({});
    await prisma.moodReport.deleteMany({});
    
    await prisma.user.deleteMany({});

    console.info('Successfully cleaned all data from database');
  } catch (error) {
    console.error('Error deleting data:', error);
    throw error;
  }
}

async function generateDummyData() {
  console.info('Generating dummy data...');

  try {
    // Create 5 users with predefined IDs for consistency
    const userData = [
      {
        id: 'user_alex_seed_001',
        name: 'Alex',
        email: 'alexandre.ramalho.1998@gmail.com',
        clerkId: 'user_30bDMTLDj4WYYD4h7VpYoQm9gAD',
        picture: 'https://lh3.googleusercontent.com/a/ACg8ocLI9cioxfK2XKVtsArYggis7j9dB7-B7JiwkzMWFsKPeVBQdXlG=s1000-c',
        username: 'alex'
      },
      {
        id: 'user_alice_seed_002',
        name: 'Alice',
        email: 'alice@example.com',
        username: 'alice'
      },
      {
        id: 'user_e2e_seed_003',
        name: 'E2E',
        email: 'alexandre.ramalho.1998+e2etracking@gmail.com',
        username: 'bamboozle',
        clerkId: 'user_2pacar3EWIkXixT3na4OkFAxwb8'
      },
      {
        id: 'user_charlie_seed_004',
        name: 'Charlie',
        email: 'charlie@example.com',
        username: 'charlie'
      },
      {
        id: 'user_tomas_seed_005',
        name: 'Tomas',
        email: 'tomas@example.com',
        username: 'tomas',
        picture: 'https://example.com/tomas.jpg'
      }
    ];

    // Create users
    const users: User[] = [];
    for (const data of userData) {
      const user = await prisma.user.create({ data });
      users.push(user);
    }

    // Set up friendships (Alex and E2E are friends, Alice referred by Alex)
    await prisma.user.update({
      where: { id: users[0].id }, // Alex
      data: {
        friends: { connect: { id: users[2].id } }, // Connect to E2E
        referredUsers: { connect: { id: users[1].id } } // Alice referred by Alex
      }
    });

    await prisma.user.update({
      where: { id: users[2].id }, // E2E
      data: {
        friends: { connect: { id: users[0].id } } // Connect to Alex
      }
    });

    // Create metrics - happiness for Alex
    const happinessMetric = await prisma.metric.create({
      data: {
        userId: users[0].id,
        title: 'Happiness',
        emoji: '😊'
      }
    });

    // Create activities
    const runningActivity = await prisma.activity.create({
      data: {
        id: 'activity_running_001',
        userId: users[0].id,
        title: 'Running',
        measure: 'kilometers',
        emoji: '🏃'
      }
    });

    const meditationActivity = await prisma.activity.create({
      data: {
        id: 'activity_meditation_002',
        userId: users[0].id,
        title: 'Meditation',
        measure: 'minutes',
        emoji: '🧘'
      }
    });

    const pushUpsActivity = await prisma.activity.create({
      data: {
        id: 'activity_pushups_003',
        userId: users[2].id, // E2E user
        title: 'push-ups',
        measure: 'times',
        emoji: '💪'
      }
    });

    // Generate activity and metric entries over 60 days
    const now = new Date();
    const baseDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

    const activityEntries: ActivityEntry[] = [];
    const metricEntries: MetricEntry[] = [];

    for (let i = 0; i < 20; i++) {
      // Space out entries roughly 3 days apart
      const currentDate = new Date(baseDate.getTime() + i * 3 * 24 * 60 * 60 * 1000);
      const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Simulate running on even-numbered entries
      if (i % 2 === 0) {
        const runEntry = await prisma.activityEntry.create({
          data: {
            activityId: runningActivity.id,
            userId: users[0].id,
            quantity: 5,
            date: dateStr
          }
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
            date: dateStr
          }
        });
        activityEntries.push(meditationEntry);
      }

      // Happiness rating - high (4-5) on running days, random (1-5) on non-running days
      const didRun = i % 2 === 0;
      const happinessRating = didRun ? 
        Math.floor(Math.random() * 2) + 4 : // 4-5
        Math.floor(Math.random() * 5) + 1;  // 1-5

      const metricEntry = await prisma.metricEntry.create({
        data: {
          userId: users[0].id,
          metricId: happinessMetric.id,
          rating: happinessRating,
          date: dateStr
        }
      });
      metricEntries.push(metricEntry);
    }

    // Create plans
    const finishingDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const marathonPlan = await prisma.plan.create({
      data: {
        id: 'plan_marathon_001',
        userId: users[0].id,
        goal: 'Run a marathon',
        emoji: '🏃',
        finishingDate: finishingDate.toISOString().split('T')[0]
      }
    });

    const meditationPlan = await prisma.plan.create({
      data: {
        id: 'plan_meditation_002',
        userId: users[1].id,
        goal: 'Meditate daily',
        emoji: '🧘',
        finishingDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    });

    // Create plan activities (junction table)
    await prisma.planActivity.create({
      data: {
        planId: marathonPlan.id,
        activityId: runningActivity.id
      }
    });

    await prisma.planActivity.create({
      data: {
        planId: meditationPlan.id,
        activityId: meditationActivity.id
      }
    });

    // Create plan sessions for marathon training (every 3 days for 90 days)
    for (let i = 0; i < 30; i++) {
      const sessionDate = new Date(now.getTime() + i * 3 * 24 * 60 * 60 * 1000);
      await prisma.planSession.create({
        data: {
          planId: marathonPlan.id,
          activityId: runningActivity.id,
          date: sessionDate.toISOString().split('T')[0],
          descriptiveGuide: `Run ${5 + i} km`,
          quantity: 5 + i
        }
      });
    }

    // Create plan sessions for meditation (daily for 30 days)
    for (let i = 0; i < 30; i++) {
      const sessionDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      await prisma.planSession.create({
        data: {
          planId: meditationPlan.id,
          activityId: meditationActivity.id,
          date: sessionDate.toISOString().split('T')[0],
          descriptiveGuide: 'Meditate for 15 minutes',
          quantity: 15
        }
      });
    }

    // Create plan groups
    const marathonPlanGroup = await prisma.planGroup.create({
      data: {
        id: 'plangroup_marathon_001'
      }
    });

    const meditationPlanGroup = await prisma.planGroup.create({
      data: {
        id: 'plangroup_meditation_002'
      }
    });

    // Update plans with plan group IDs
    await prisma.plan.update({
      where: { id: marathonPlan.id },
      data: { planGroupId: marathonPlanGroup.id }
    });

    await prisma.plan.update({
      where: { id: meditationPlan.id },
      data: { planGroupId: meditationPlanGroup.id }
    });

    // Create plan group members
    await prisma.planGroupMember.create({
      data: {
        planGroupId: marathonPlanGroup.id,
        userId: users[0].id,
        username: users[0].username!,
        name: users[0].name!,
        picture: users[0].picture
      }
    });

    await prisma.planGroupMember.create({
      data: {
        planGroupId: meditationPlanGroup.id,
        userId: users[1].id,
        username: users[1].username!,
        name: users[1].name!,
        picture: users[1].picture
      }
    });

    // Create plan invitations
    const planInvitation1 = await prisma.planInvitation.create({
      data: {
        id: 'planinvite_001',
        planId: marathonPlan.id,
        senderId: users[0].id,
        recipientId: users[1].id
      }
    });

    const planInvitation2 = await prisma.planInvitation.create({
      data: {
        id: 'planinvite_002',
        planId: meditationPlan.id,
        senderId: users[1].id,
        recipientId: users[2].id
      }
    });

    // Create friend requests
    const friendRequest1 = await prisma.friendRequest.create({
      data: {
        id: 'friendreq_001',
        senderId: users[1].id, // Alice
        recipientId: users[0].id // Alex
      }
    });

    const friendRequest2 = await prisma.friendRequest.create({
      data: {
        id: 'friendreq_002',
        senderId: users[4].id, // Tomas
        recipientId: users[0].id // Alex
      }
    });

    // Create notifications for friend requests
    await prisma.notification.create({
      data: {
        userId: friendRequest1.recipientId,
        message: `${users[1].name} sent you a friend request`,
        type: 'FRIEND_REQUEST',
        relatedId: friendRequest1.id,
        relatedData: {
          id: users[1].id,
          name: users[1].name,
          username: users[1].username,
          picture: users[1].picture
        }
      }
    });

    await prisma.notification.create({
      data: {
        userId: friendRequest2.recipientId,
        message: `${users[4].name} sent you a friend request`,
        type: 'FRIEND_REQUEST',
        relatedId: friendRequest2.id,
        relatedData: {
          id: users[4].id,
          name: users[4].name,
          username: users[4].username,
          picture: users[4].picture
        }
      }
    });

    // Create notifications for plan invitations
    await prisma.notification.create({
      data: {
        userId: planInvitation1.recipientId,
        message: `${users[0].name} invited you to join the plan: ${marathonPlan.goal}`,
        type: 'PLAN_INVITATION',
        relatedId: planInvitation1.id,
        relatedData: {
          id: users[0].id,
          name: users[0].name,
          username: users[0].username,
          picture: users[0].picture
        }
      }
    });

    await prisma.notification.create({
      data: {
        userId: planInvitation2.recipientId,
        message: `${users[1].name} invited you to join the plan: ${meditationPlan.goal}`,
        type: 'PLAN_INVITATION',
        relatedId: planInvitation2.id,
        relatedData: {
          id: users[1].id,
          name: users[1].name,
          username: users[1].username,
          picture: users[1].picture
        }
      }
    });

    // Create engagement notifications
    await prisma.notification.create({
      data: {
        userId: users[0].id,
        message: "How's your training going? Let's check in on your progress!",
        type: 'ENGAGEMENT',
        recurrence: 'DAILY'
      }
    });

    await prisma.notification.create({
      data: {
        userId: users[0].id,
        message: "Time for your weekly reflection! Let's take a moment to look back at your journey. What goals have you accomplished this week? What challenges did you overcome? What have you learned about yourself through tracking your activities and working towards your goals?",
        type: 'ENGAGEMENT',
        recurrence: 'WEEKLY'
      }
    });

    // Print final state
    console.info('\nFinal state:');
    for (const user of users) {
      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          friends: true,
          activities: {
            include: {
              entries: {
                orderBy: { date: 'desc' },
                take: 5
              }
            }
          },
          plans: {
            include: {
              planGroup: {
                include: {
                  members: true
                }
              },
              sessions: {
                take: 5
              }
            }
          },
          notifications: {
            where: { concludedAt: null }
          }
        }
      });

      if (!userData) continue;

      console.info(`\nUser: ${userData.name} (username: ${userData.username})`);
      console.info(`Friends: ${userData.friends.map(f => f.name).join(', ')}`);
      
      const pendingPlanInvitations = await prisma.planInvitation.count({
        where: { recipientId: userData.id, status: 'PENDING' }
      });
      const pendingFriendRequests = await prisma.friendRequest.count({
        where: { recipientId: userData.id, status: 'PENDING' }
      });
      
      console.info(`Pending Plan Invitations: ${pendingPlanInvitations}`);
      console.info(`Pending Friend Requests: ${pendingFriendRequests}`);
      
      console.info('Activities:');
      for (const activity of userData.activities) {
        console.info(`- ${activity.title}`);
        for (const entry of activity.entries) {
          console.info(`  * ${entry.date}: ${entry.quantity} ${activity.measure}`);
        }
      }

      console.info('Plans:');
      for (const plan of userData.plans) {
        console.info(`- ${plan.goal} (Finishing date: ${plan.finishingDate})`);
        if (plan.planGroup) {
          console.info(`  Members: ${plan.planGroup.members.map(m => m.name).join(', ')}`);
        }
        console.info(`  Sessions: ${plan.sessions.length}`);
      }

      console.info('Notifications:');
      for (const notification of userData.notifications) {
        console.info(`- Type: ${notification.type}`);
        console.info(`  Message: ${notification.message}`);
        console.info(`  Status: ${notification.status}`);
      }
    }

    console.info('Done! 🎉');
  } catch (error) {
    console.error('Error generating dummy data:', error);
    throw error;
  }
}

async function main() {
  if (!isDevelopment()) {
    console.error('This script is only available in the development environment.');
    process.exit(1);
  }

  try {
    await deleteAllData();
    await generateDummyData();
  } catch (error) {
    console.error('Error running seed script:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { deleteAllData, generateDummyData };