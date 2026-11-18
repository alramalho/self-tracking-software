import { formatInTimeZone } from "date-fns-tz";
import type { FollowThroughState } from "@tsw/prisma/follow-through";
import { answerCoverage, isLearningPlan } from "@tsw/prisma/follow-through/coverage";
import { prisma } from "../../../utils/prisma";
import { logger } from "../../../utils/logger";
import { getCoachPersonalityConfig } from "../../coachPersonalityService";
import { effortFor, planModel } from "../../aiModelIds";
import { gatewayGenerator } from "../../plan-design/generator";
import type { ObjectGenerator } from "../../plan-design/types";
import { changeState } from "../../follow-through/store";
import { PlanProposalPatchSchema } from "../../planProposalPatchService";
import { planProposalBasis } from "../monitoring/proposal-basis";
import { coveragePrompt } from "./prompt";
import { coverageSchema } from "./schema";
import type { CoverageInput, CoverageLogged, CoverageResult } from "./types";

const COURSE_LINE = /^Course or book they follow: (.+)$/m;

/**
 * After a Share more note on a learning plan: what they covered, and, when they are clearly ahead of or
 * behind the plan, a suggested change to the next sessions as a coach message with Review Changes.
 * Null when no learning plan with coaching on owns the logged activity.
 */
export async function checkCoverage(
  userId: string,
  logged: CoverageLogged[],
  said: string,
  generate: ObjectGenerator = gatewayGenerator,
): Promise<CoverageResult | null> {
  if (!said.trim() || !logged.length) return null;
  const [user, row] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { coachPersonality: true, timezone: true } }),
    prisma.coachingState.findUnique({ where: { userId } }),
  ]);
  const state = row?.data as unknown as FollowThroughState | undefined;
  const plans = await prisma.plan.findMany({
    where: {
      userId,
      deletedAt: null,
      archivedAt: null,
      activities: { some: { id: { in: logged.map((l) => l.activityId) } } },
    },
    include: { activities: true, sessions: true, milestones: true },
  });
  const plan = plans.find((p) => {
    const role = state?.supports[p.id]?.coaching?.role;
    return isLearningPlan(p) && !!role && role !== "tracking";
  });
  if (!plan || !user) return null;
  const log = logged.find((l) => plan.activities.some((a) => a.id === l.activityId))!;
  const day = (date: Date) => date.toISOString().slice(0, 10);
  const planned = plan.sessions.find((s) => s.activityId === log.activityId && day(s.date) === log.date) ?? null;
  const upcoming = plan.sessions
    .filter((s) => day(s.date) > log.date)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3);
  const coach = getCoachPersonalityConfig(user.coachPersonality);
  const input: CoverageInput = {
    plan: {
      goal: plan.goal,
      course: plan.notes?.match(COURSE_LINE)?.[1] ?? state?.supports[plan.id]?.resourceName ?? null,
    },
    planned: planned ? { title: planned.title, guide: planned.descriptiveGuide } : null,
    said: said.slice(0, 2000),
    upcoming: upcoming.map((s) => ({ id: s.id, date: day(s.date), title: s.title, guide: s.descriptiveGuide })),
    coach: coach.displayName,
  };
  const model = planModel("quick");
  const { object } = await generate({
    name: "learningCoverage",
    schema: coverageSchema,
    system: coveragePrompt(coach.systemPrompt),
    prompt: JSON.stringify(input),
    model,
    effort: effortFor(model),
  });

  // Only sessions that are still ahead, and only with a reason to show.
  const ids = new Set(upcoming.map((s) => s.id));
  const sessions = object.sessions.filter((s) => ids.has(s.id));
  const change = (object.pace === "AHEAD" || object.pace === "BEHIND") && !!object.message && sessions.length > 0;
  let suggestion: CoverageResult["suggestion"] = null;
  if (change) {
    const chat =
      (await prisma.chat.findFirst({ where: { userId, type: "COACH" }, orderBy: { updatedAt: "desc" } })) ??
      (await prisma.chat.create({ data: { userId, type: "COACH" } }));
    const patch = PlanProposalPatchSchema.parse({
      sessions: { upsert: sessions.map((s) => ({ id: s.id, title: s.title, descriptiveGuide: s.descriptiveGuide })) },
    });
    const message = await prisma.message.create({
      data: {
        chatId: chat.id,
        planId: plan.id,
        role: "COACH",
        content: object.message!,
        metadata: JSON.parse(
          JSON.stringify({
            source: "learning_coverage",
            requiresReply: true,
            planIds: [plan.id],
            planProposals: [
              {
                planId: plan.id,
                planGoal: plan.goal,
                planEmoji: plan.emoji,
                description: object.message,
                patch,
                status: null,
              },
            ],
            planBasis: { [plan.id]: planProposalBasis(plan) },
          }),
        ),
      },
    });
    await prisma.chat.update({ where: { id: chat.id }, data: { updatedAt: new Date() } });
    suggestion = { message: object.message!, chatId: chat.id, messageId: message.id };
  }

  const today = formatInTimeZone(new Date(), user.timezone || "UTC", "yyyy-MM-dd");
  await changeState(userId, async (s) => {
    s.coverage = {
      ...s.coverage,
      [plan.id]: { ...answerCoverage(s.coverage?.[plan.id]), last: { date: today, pace: object.pace, covered: object.covered } },
    };
  });
  logger.info(`learningCoverage: plan=${plan.id} pace=${object.pace} suggestion=${!!suggestion}`);
  return { pace: object.pace, covered: object.covered, suggestion };
}
