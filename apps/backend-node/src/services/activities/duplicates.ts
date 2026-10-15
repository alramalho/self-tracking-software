import {
  canCombine,
  chooseActivityToKeep,
  findNameTwin,
  mergeConversion,
} from "@tsw/prisma/activity-duplicates";
import { evaluate } from "../../utils/aiSdk";
import { currentUserAllowsAi } from "../../utils/aiConsent";
import { logger } from "../../utils/logger";
import { prisma } from "../../utils/prisma";
import type { ActivityWithCount, DuplicateMatch, MergeSuggestion } from "./types";

const JEV_MODEL = "typesafe-ai/jev";
const MIN_MATCH_SCORE = 0.86;
const MIN_MATCH_MARGIN = 0.08;
// The question appears right after saving, so a slow answer is no answer.
const JEV_TIMEOUT_MS = 2500;
const MAX_JEV_CANDIDATES = 8;

async function activitiesWithCounts(userId: string): Promise<ActivityWithCount[]> {
  const activities = await prisma.activity.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { entries: { where: { deletedAt: null } } } },
    },
  });
  return activities.map(({ _count, ...activity }) => ({
    ...activity,
    entryCount: _count.entries,
  }));
}

/** Asks Jev which existing activity, if any, is the same habit as the new one. */
async function findMeaningTwin(activity: ActivityWithCount, candidates: ActivityWithCount[]) {
  if (candidates.length === 0 || !currentUserAllowsAi()) return undefined;
  const shortlist = [...candidates]
    .sort((a, b) => b.entryCount - a.entryCount)
    .slice(0, MAX_JEV_CANDIDATES);
  try {
    const result = await evaluate({
      model: JEV_MODEL,
      state: JSON.stringify({
        newActivity: { title: activity.title, emoji: activity.emoji, measure: activity.measure },
        existingActivities: shortlist.map((candidate, index) => ({
          key: `existing_${index}`,
          title: candidate.title,
          emoji: candidate.emoji,
          measure: candidate.measure,
        })),
      }),
      questions: Object.fromEntries(
        shortlist.map((candidate, index) => [
          `existing_${index}`,
          {
            type: "boolean" as const,
            instructions: `Is the new activity the same habit as the existing activity "${candidate.title}", so the person would log the very same sessions under either name? Answer yes for synonyms, translations and different word forms (for example "Hike" and "Hiking", "Jogging" and "Running", "Meditate" and "Meditation"). Answer no when one is a distinct variant people usually track separately (for example "Running" and "Trail running", "Guitar" and "Music writing", "Gym" and "Yoga").`,
          },
        ]),
      ),
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(JEV_TIMEOUT_MS),
    });
    const scores = shortlist
      .map((candidate, index) => {
        const answer = result.answers[`existing_${index}`];
        return { candidate, score: answer?.type === "boolean" ? answer.probability : 0 };
      })
      .sort((a, b) => b.score - a.score);
    const [best, runnerUp] = scores;
    if (!best || best.score < MIN_MATCH_SCORE) return undefined;
    if (runnerUp && best.score - runnerUp.score < MIN_MATCH_MARGIN) return undefined;
    return best.candidate;
  } catch (error) {
    // Never block saving an activity on the evaluator.
    logger.warn(`Activity duplicate check skipped: ${error instanceof Error ? error.message : error}`);
    return undefined;
  }
}

function withoutCount({ entryCount: _, ...activity }: ActivityWithCount) {
  return activity;
}

async function plansUsing(userId: string, activityId: string) {
  return prisma.plan.count({
    where: { userId, deletedAt: null, activities: { some: { id: activityId } } },
  });
}

async function suggestion(
  userId: string,
  a: ActivityWithCount,
  b: ActivityWithCount,
  match: DuplicateMatch,
): Promise<MergeSuggestion> {
  const [keep, remove] = chooseActivityToKeep(a, b);
  const conversion = mergeConversion(keep, remove);
  return {
    match,
    keep: withoutCount(keep),
    remove: withoutCount(remove),
    entriesToMove: remove.entryCount,
    plansToUpdate: await plansUsing(userId, remove.id),
    conversion: conversion
      ? {
          activityId: conversion.activity.id,
          from: conversion.from,
          to: conversion.to,
          factor: conversion.factor,
        }
      : null,
  };
}

/**
 * Another activity of this person's that is the same habit, ready to merge.
 * The name rule answers instantly; Jev is asked only when `byMeaning` is set.
 * Logs must add up, so only the same measure or one that converts exactly is suggested.
 */
export async function findDuplicateActivity(
  userId: string,
  activityId: string,
  { byMeaning }: { byMeaning: boolean },
): Promise<MergeSuggestion | null> {
  const activities = await activitiesWithCounts(userId);
  const activity = activities.find((candidate) => candidate.id === activityId);
  if (!activity) return null;
  const candidates = activities.filter(
    (candidate) => candidate.id !== activity.id && canCombine(candidate, activity),
  );

  const nameTwin = findNameTwin(activity.title, candidates);
  if (nameTwin) return suggestion(userId, activity, nameTwin, "name");
  if (!byMeaning) return null;

  const meaningTwin = await findMeaningTwin(activity, candidates);
  return meaningTwin ? suggestion(userId, activity, meaningTwin, "meaning") : null;
}
