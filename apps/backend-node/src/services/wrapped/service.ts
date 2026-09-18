import { yearBounds, yearPlanStats } from "./model";
import type { WrappedDatabase, WrappedLeaderboard } from "./types";
const personFields = { id: true, username: true, name: true, picture: true } as const;
export async function getWrappedLeaderboard(db: WrappedDatabase, viewerId: string, year: number): Promise<WrappedLeaderboard> {
  const { start, end } = yearBounds(year);
  const viewer = await db.user.findUnique({
    where: { id: viewerId, deletedAt: null },
    select: {
      ...personFields,
      connectionsFrom: { where: { status: "ACCEPTED", to: { deletedAt: null } }, select: { to: { select: personFields } } },
      connectionsTo: { where: { status: "ACCEPTED", from: { deletedAt: null } }, select: { from: { select: personFields } } },
    },
  });
  if (!viewer) throw new Error("User not found");
  const people = [...new Map([viewer, ...viewer.connectionsFrom.map(c => c.to), ...viewer.connectionsTo.map(c => c.from)].map(p => [p.id, p])).values()];
  const ids = people.map(p => p.id);
  const [counts, plans] = await Promise.all([
    db.activityEntry.groupBy({ by: ["userId"], where: { userId: { in: ids }, deletedAt: null, activityId: { not: null }, activity: { deletedAt: null }, datetime: { gte: start, lt: end } }, _count: { _all: true } }),
    // Finished/archived plans still contributed to that year's achievements.
    db.plan.findMany({ where: { userId: { in: ids }, deletedAt: null, createdAt: { lt: end } }, select: { id: true, userId: true, progressState: true } }),
  ]);
  const annualPlans = plans.map(p => ({ userId: p.userId, stats: yearPlanStats(p.id, p.progressState, year) }));
  return {
    year, timezone: "UTC",
    plans: annualPlans.filter(p => p.userId === viewerId).map(p => p.stats),
    people: people.map(p => {
      const earned = annualPlans.filter(plan => plan.userId === p.id).map(plan => plan.stats);
      const totalActivitiesLogged = counts.find(c => c.userId === p.id)?._count._all ?? 0;
      const habitCount = earned.filter(plan => plan.habitEarned).length;
      const lifestyleCount = earned.filter(plan => plan.lifestyleEarned).length;
      return { id: p.id, username: p.username ?? p.id, name: p.name, picture: p.picture, totalActivitiesLogged, habitCount, lifestyleCount, totalPoints: totalActivitiesLogged + habitCount * 25 + lifestyleCount * 100, bestStreak: Math.max(0, ...earned.map(plan => plan.peakStreak)) };
    }),
  };
}
