import { formatInTimeZone } from "date-fns-tz";
import type { DesignBaseline, GoalSpec, SessionTargets } from "@tsw/prisma/follow-through";
import { PlanProposalPatchSchema } from "../../../planProposalPatchService";
import { extendWindow } from "../../../plan-design/service";
import type { WindowInput, WindowResult } from "../../../plan-design/types";
import type { CoachDraftMessage } from "../../types";
import type { ScheduledCoachInput } from "./types";

type CoachPlan = ScheduledCoachInput["plans"][number];
type Outline = WindowInput["outline"];

/** Plans made by the onboarding carry their road. A chat-made outcome plan gets a plain one from its own sessions. */
function outlineOf(plan: CoachPlan): Outline | null {
  if (plan.outline) return plan.outline as unknown as Outline;
  if (plan.orientation !== "OUTCOME" || !plan.sessions.length) return null;
  const perWeek = new Map<string, Set<string>>();
  for (const s of plan.sessions) {
    const day = s.date.toISOString().slice(0, 10);
    const week = new Date(s.date.getTime() - ((s.date.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
    perWeek.set(week, (perWeek.get(week) ?? new Set()).add(day));
  }
  const counts = [...perWeek.values()].map((days) => days.size);
  const start = plan.createdAt.toISOString().slice(0, 10);
  return {
    route: "steady",
    coach: "Helly",
    phases: [],
    assumptions: [],
    daysMin: Math.min(...counts),
    daysMax: Math.max(...counts),
    startDate: start,
    estimatedWeeks: plan.finishingDate ? Math.max(2, Math.ceil((plan.finishingDate.getTime() - plan.createdAt.getTime()) / (7 * 86_400_000))) : 12,
  };
}

/** A coached outcome plan whose dated sessions end within a week needs its next weeks designed. */
export function windowDue(plan: CoachPlan, today: string) {
  if (plan.orientation !== "OUTCOME" || !plan.designedThrough || !outlineOf(plan)) return false;
  const left = (plan.designedThrough.getTime() - Date.parse(`${today}T12:00:00Z`)) / 86_400_000;
  return left < 8;
}

/** Everything the generator may use, from the plan and its logs. Completed = a log the same day for that activity. */
export function windowInput(
  plan: CoachPlan,
  input: ScheduledCoachInput,
  health: string | null,
  feedback: string | null,
): WindowInput {
  const tz = input.user.timezone || "UTC";
  const day = (d: Date) => formatInTimeZone(d, tz, "yyyy-MM-dd");
  const logged = new Set(input.entries.map((e) => `${e.activityId}:${day(e.datetime)}`));
  const activityIds = new Set(plan.activities.map((a) => a.id));
  return {
    goal: plan.goal,
    goalSpec: plan.goalSpec as GoalSpec | null,
    baseline: plan.baseline as DesignBaseline | null,
    outline: outlineOf(plan)!,
    finishingDate: plan.finishingDate?.toISOString().slice(0, 10) ?? null,
    activities: plan.activities.map((a) => ({
      id: a.id,
      key: a.id,
      title: a.title,
      measure: a.measure,
      emoji: a.emoji ?? "",
    })),
    sessions: plan.sessions.map((s) => {
      const date = s.date.toISOString().slice(0, 10);
      return {
        id: s.id,
        date,
        activityId: s.activityId,
        quantity: s.quantity,
        title: s.title,
        targets: s.targets as SessionTargets | null,
        completed: logged.has(`${s.activityId}:${date}`),
      };
    }),
    results: input.entries
      .filter((e) => e.activityId && activityIds.has(e.activityId))
      .slice(-20)
      .map((e) => ({
        date: day(e.datetime),
        activityId: e.activityId!,
        quantity: e.quantity,
        difficulty: e.difficulty,
        note: e.privateNotes,
      })),
    approvedHealthContext: health,
    today: day(input.now),
    feedback,
  };
}

/** One proposal for the person to review; nothing changes until they accept it. */
export function windowMessage(plan: CoachPlan, result: WindowResult): CoachDraftMessage {
  const patch = PlanProposalPatchSchema.parse({
    plan: { designedThrough: result.designedThrough, outlinePhases: result.phases },
    sessions: {
      upsert: result.sessions.map((s) => ({
        activityId: s.activityId,
        date: s.date,
        quantity: s.quantity,
        title: s.title,
        descriptiveGuide: s.descriptiveGuide,
        targets: s.targets,
      })),
      ...(result.replaceSessionIds.length ? { deleteIds: result.replaceSessionIds } : {}),
    },
  });
  return {
    content: result.summary,
    requiresReply: false,
    planProposals: [
      {
        planId: plan.id,
        planGoal: plan.goal,
        planEmoji: plan.emoji,
        description: `Your next two weeks, until ${result.designedThrough}`,
        patch,
        status: null,
      },
    ],
  };
}

export async function designNextWindow(
  plan: CoachPlan,
  input: ScheduledCoachInput,
  health: string | null,
  replaceUpcoming: boolean,
  feedback: string | null,
) {
  const result = await extendWindow({ ...windowInput(plan, input, health, feedback), replaceUpcoming });
  return { message: windowMessage(plan, result), usage: result.usage };
}
