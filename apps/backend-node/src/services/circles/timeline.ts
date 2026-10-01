import { TZDate } from "@date-fns/tz";
import { format, startOfWeek } from "date-fns";
import { prisma } from "../../utils/prisma";
import { weeklyTarget } from "./matching/profiles";
import type { WeekChip } from "./types";

export interface CircleTag {
  id: string;
  name: string;
  emoji: string;
}

// Whose circle plan an activity belongs to, with what the "3 of 4 this week" chip needs.
export interface ChipPlan {
  userId: string;
  timezone: string | null;
  target: number;
  activityIds: string[];
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
    return {
      peers: [],
      activityCircle: new Map<string, CircleTag>(),
      sharedSince: new Map<string, { userId: string; since: Date }>(),
      chipPlans: new Map<string, ChipPlan>(),
    };

  const members = await prisma.circleMember.findMany({
    where: {
      circleId: { in: mine.map((m) => m.circleId) },
      userId: { notIn: hidden },
      // Only proven members' logs are shared; a pending member's proof shows once it's posted.
      provenAt: { not: null },
      user: { deletedAt: null },
      plan: { deletedAt: null },
    },
    select: {
      userId: true,
      joinedAt: true,
      circle: { select: { id: true, name: true, emoji: true } },
      user: { select: { ...timelineUser, timezone: true } },
      plan: {
        select: {
          id: true,
          visibility: true,
          timesPerWeek: true,
          coachSuggestedTimesPerWeek: true,
          progressState: true,
          activities: { select: { id: true } },
        },
      },
    },
  });

  const activityCircle = new Map<string, CircleTag>();
  const sharedSince = new Map<string, { userId: string; since: Date }>();
  const chipPlans = new Map<string, ChipPlan>();
  type Peer = Omit<(typeof members)[number]["user"], "timezone"> & {
    plans: Pick<(typeof members)[number]["plan"], "id" | "visibility" | "activities">[];
  };
  const peers = new Map<string, Peer>();
  for (const m of members) {
    const chipPlan = {
      userId: m.userId,
      timezone: m.user.timezone,
      target: weeklyTarget(m.plan),
      activityIds: m.plan.activities.map((a) => a.id),
    };
    for (const activity of m.plan.activities) {
      activityCircle.set(activity.id, m.circle);
      sharedSince.set(activity.id, { userId: m.userId, since: m.joinedAt });
      chipPlans.set(activity.id, chipPlan);
    }
    if (m.userId === viewerId) continue;
    const { timezone: _timezone, ...user } = m.user;
    const peer = peers.get(m.userId) ?? { ...user, plans: [] };
    peer.plans.push({ id: m.plan.id, visibility: m.plan.visibility, activities: m.plan.activities });
    peers.set(m.userId, peer);
  }
  return { peers: [...peers.values()], activityCircle, sharedSince, chipPlans };
}

const localDay = (date: Date, timezone: string | null) => format(new TZDate(date, timezone || "UTC"), "yyyy-MM-dd");
const localWeek = (date: Date, timezone: string | null) =>
  format(startOfWeek(new TZDate(date, timezone || "UTC"), { weekStartsOn: 0 }), "yyyy-MM-dd");

// "3 of 4 this week" for circle logs: the days their owner had logged on that plan that week,
// up to and including the log's own day. Makes cheering mean something: you can see which
// session completes a week, and which one is a comeback.
export async function weekChips(
  entries: { id: string; userId: string; activityId: string | null; datetime: Date }[],
  plans: Map<string, ChipPlan>,
): Promise<Map<string, WeekChip>> {
  const tagged = entries.flatMap((entry) => {
    const plan = entry.activityId ? plans.get(entry.activityId) : undefined;
    return plan && plan.userId === entry.userId ? [{ entry, plan }] : [];
  });
  const chips = new Map<string, WeekChip>();
  if (!tagged.length) return chips;
  const times = tagged.map((t) => t.entry.datetime.getTime());
  const logs = await prisma.activityEntry.findMany({
    where: {
      deletedAt: null,
      activityId: { in: [...new Set(tagged.flatMap((t) => t.plan.activityIds))] },
      // A week back from the oldest log covers its whole week in any time zone.
      datetime: { gte: new Date(Math.min(...times) - 7 * 24 * 60 * 60 * 1000), lte: new Date(Math.max(...times)) },
    },
    select: { activityId: true, datetime: true },
  });
  for (const { entry, plan } of tagged) {
    const week = localWeek(entry.datetime, plan.timezone);
    const day = localDay(entry.datetime, plan.timezone);
    const days = new Set(
      logs
        .filter((log) => !!log.activityId && plan.activityIds.includes(log.activityId))
        .filter((log) => localWeek(log.datetime, plan.timezone) === week)
        .map((log) => localDay(log.datetime, plan.timezone))
        .filter((logDay) => logDay <= day),
    );
    chips.set(entry.id, { done: days.size, target: plan.target });
  }
  return chips;
}
