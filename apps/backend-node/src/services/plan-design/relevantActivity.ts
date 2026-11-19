import { activityNameKey } from "@tsw/prisma/activity-duplicates";
import { evaluate } from "../../utils/aiSdk";
import { currentUserAllowsAi } from "../../utils/aiConsent";
import { logger } from "../../utils/logger";
import type { LoggedActivity } from "./types";

const JEV_MODEL = "typesafe-ai/jev";
// Measured with scripts/plan-history/bench.ts (scores logged with PLAN_HISTORY_SCORES=1).
const MIN_MATCH_SCORE = 0.5;
const MIN_MATCH_MARGIN = 0.2;
// Asked alongside the coach's classification, which takes about 1.5 s; never worth a longer wait.
const JEV_TIMEOUT_MS = 2500;
const MAX_CANDIDATES = 8;

/**
 * Which of the person's logged activities the goal is about, read from the goal itself.
 * Jev handles what names can't: another language ("quero meditar todos os dias" → "Meditate"),
 * typos ("meditaton"), synonyms ("jogging" → "Running"). Null when no logged activity clearly fits.
 */
export async function activityTheGoalIsAbout(goal: string, history: LoggedActivity[]): Promise<LoggedActivity | null> {
  const candidates = history.filter((a) => a.lastLoggedAt).slice(0, MAX_CANDIDATES);
  if (candidates.length === 0 || !currentUserAllowsAi()) return null;
  try {
    const result = await evaluate({
      model: JEV_MODEL,
      state: JSON.stringify({
        goal,
        loggedActivities: candidates.map((a, index) => ({ key: `logged_${index}`, title: a.title, emoji: a.emoji, measure: a.measure })),
      }),
      questions: Object.fromEntries(
        candidates.map((a, index) => [
          `logged_${index}`,
          {
            type: "boolean" as const,
            instructions: `Is this goal about the habit the person already logs as "${a.title}", so a plan for the goal would track those very same sessions? Answer yes whatever the language, spelling or word form (for example "quero meditar todos os dias" and "Meditate", "go runing 3x a week" and "Running", "Jogging" and "Running"). Answer no when the goal is about a different activity or a distinct variant people track separately (for example "Trail running" and "Running", "Yoga" and "Gym").`,
          },
        ]),
      ),
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(JEV_TIMEOUT_MS),
    });
    const scores = candidates
      .map((a, index) => {
        const answer = result.answers[`logged_${index}`];
        return { activity: a, score: answer?.type === "boolean" ? answer.probability : 0 };
      })
      .sort((a, b) => b.score - a.score);
    if (process.env.PLAN_HISTORY_SCORES) logger.info(`scores ${goal}: ${scores.map((s) => `${s.activity.title}=${s.score.toFixed(2)}`).join(" ")}`);
    const [best, runnerUp] = scores;
    if (!best || best.score < MIN_MATCH_SCORE) return null;
    if (runnerUp && best.score - runnerUp.score < MIN_MATCH_MARGIN) return null;
    return best.activity;
  } catch (error) {
    // Without an answer the person simply describes where they are.
    logger.warn(`Plan history match skipped: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/** The logged activity with the coach's activity name, ignoring case and word endings ("Run"/"Running"). */
export function loggedActivityNamed(history: LoggedActivity[], title: string): LoggedActivity | null {
  const key = activityNameKey(title);
  if (key.length < 3) return null;
  return history.find((a) => activityNameKey(a.title) === key) ?? null;
}
