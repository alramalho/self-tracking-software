import type { Prisma, User } from "@tsw/prisma";
import type { PlanDesign } from "@tsw/prisma/follow-through";
import { FollowThroughInputError } from "../follow-through/errors";
import { materialize } from "../follow-through/model";
import { canCoach } from "../follow-through/service";
import { changeState, ownedPlans } from "../follow-through/store";
import { routeCoach } from "./frequency";

const json = (value: unknown) => value as unknown as Prisma.InputJsonValue;
const noon = (day: string) => new Date(`${day}T12:00:00Z`);

/**
 * "Plan this with my coach" for a plan that already exists (made by hand, in chat, or as a plain habit).
 * The person has reviewed the design exactly as in onboarding; this applies it to the existing plan.
 * Past sessions and any session the person already logged are kept; the rest of the future is replaced.
 * A habit just gets its weekly target and type. Coaching itself still needs an active subscription:
 * without one the plan keeps its designed sessions as free tracking, same as onboarding.
 */
export async function redesignPlan(user: User, planId: string, design: PlanDesign) {
  const chosen = design.options.find((o) => o.id === design.selected);
  if (design.orientation === "OUTCOME" && !chosen) throw new FollowThroughInputError("Choose one of the two plans first");
  return changeState(user.id, async (state, tx) => {
    const plan = await tx.plan.findFirst({
      where: { id: planId, userId: user.id, deletedAt: null, archivedAt: null },
      include: { activities: true },
    });
    if (!plan) throw new FollowThroughInputError("Plan not found");
    const wanted = design.activities[0];
    const activity = plan.activities.find((a) => a.title.toLowerCase() === wanted.title.toLowerCase()) ?? plan.activities[0];
    if (!activity) throw new FollowThroughInputError("This plan has no activity to design sessions for");

    if (chosen) {
      // Keep the past, and anything already logged. Replace the rest of the future.
      const logged = await tx.activityEntry.findMany({
        where: { userId: user.id, activityId: activity.id, deletedAt: null, datetime: { gte: noon(design.startDate) } },
        select: { datetime: true },
      });
      const loggedDays = new Set(logged.map((e) => e.datetime.toISOString().slice(0, 10)));
      const upcoming = await tx.planSession.findMany({ where: { planId, date: { gte: noon(design.startDate) } }, select: { id: true, date: true } });
      await tx.planSession.deleteMany({ where: { id: { in: upcoming.filter((s) => !loggedDays.has(s.date.toISOString().slice(0, 10))).map((s) => s.id) } } });
      const last = chosen.sessions.reduce((m, s) => (s.date > m ? s.date : m), "");
      await tx.plan.update({
        where: { id: planId },
        data: {
          orientation: "OUTCOME",
          goalSpec: json(design.goalSpec),
          baseline: json(design.baseline),
          outline: json({
            route: chosen.id, coach: routeCoach[chosen.id], phases: chosen.phases, assumptions: chosen.assumptions,
            daysMin: chosen.daysMin, daysMax: chosen.daysMax, startDate: design.startDate, estimatedWeeks: chosen.estimatedWeeks,
          }),
          designedThrough: last ? noon(last) : null,
          outlineType: "SPECIFIC",
          timesPerWeek: chosen.daysMin,
          estimatedWeeks: chosen.estimatedWeeks,
          durationType: "CUSTOM",
          finishingDate: noon(chosen.finishingDate),
          sessions: {
            create: chosen.sessions.map((s) => ({
              activityId: activity.id,
              date: noon(s.date),
              quantity: s.quantity,
              title: s.title,
              descriptiveGuide: s.descriptiveGuide,
              targets: json(s.targets),
              isCoachSuggested: true,
            })),
          },
        },
      });
    } else {
      await tx.plan.update({
        where: { id: planId },
        data: {
          orientation: "CONSISTENCY",
          goalSpec: json(design.goalSpec),
          baseline: json(design.baseline),
          outlineType: "TIMES_PER_WEEK",
          timesPerWeek: design.preferredDays,
        },
      });
    }

    const support = state.supports[planId];
    if (support && canCoach(user)) {
      support.coaching = {
        ...(support.coaching ?? { followUps: false, dataAccess: { workouts: false, sleep: false } }),
        role: chosen ? "training" : "consistency",
      };
      support.preferences = { ...support.preferences, coaching: true, weeklyReview: true, checkIn: !!chosen };
    }
    materialize(state, await ownedPlans(user.id, tx), new Date());
    return { planId };
  });
}
