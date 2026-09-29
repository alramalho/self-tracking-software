import { prisma } from "../../utils/prisma";

export interface CircleTag {
  id: string;
  name: string;
  emoji: string;
}

const timelineUser = {
  id: true,
  username: true,
  name: true,
  picture: true,
  planType: true,
} as const;

// What the home timeline needs from the viewer's circles: the people in them, and for
// each circle plan its activities, when its owner joined, and which circle to label it with.
// Joining a circle shares that one plan with its members, even if it's private to everyone else.
export async function timelineCircles(viewerId: string, hidden: string[]) {
  const mine = await prisma.circleMember.findMany({
    where: { userId: viewerId },
    select: { circleId: true },
  });
  if (!mine.length)
    return { peers: [], activityCircle: new Map<string, CircleTag>(), sharedSince: new Map<string, { userId: string; since: Date }>() };

  const members = await prisma.circleMember.findMany({
    where: {
      circleId: { in: mine.map((m) => m.circleId) },
      userId: { notIn: hidden },
      user: { deletedAt: null },
      plan: { deletedAt: null },
    },
    select: {
      userId: true,
      joinedAt: true,
      circle: { select: { id: true, name: true, emoji: true } },
      user: { select: timelineUser },
      plan: { select: { id: true, visibility: true, activities: { select: { id: true } } } },
    },
  });

  const activityCircle = new Map<string, CircleTag>();
  const sharedSince = new Map<string, { userId: string; since: Date }>();
  const peers = new Map<string, (typeof members)[number]["user"] & { plans: (typeof members)[number]["plan"][] }>();
  for (const m of members) {
    for (const activity of m.plan.activities) {
      activityCircle.set(activity.id, m.circle);
      sharedSince.set(activity.id, { userId: m.userId, since: m.joinedAt });
    }
    if (m.userId === viewerId) continue;
    const peer = peers.get(m.userId) ?? { ...m.user, plans: [] };
    peer.plans.push(m.plan);
    peers.set(m.userId, peer);
  }
  return { peers: [...peers.values()], activityCircle, sharedSince };
}
