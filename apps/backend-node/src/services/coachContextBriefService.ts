import { Activity, Plan, PlanSession, User } from "@tsw/prisma";
import { differenceInCalendarDays, subDays } from "date-fns";
import { prisma } from "../utils/prisma";

type CoachPlan = Plan & { activities: Activity[]; sessions: PlanSession[] };

export type CoachContextBriefCandidate = {
  type:
    | "INACTIVITY_ARCHIVE_PROPOSAL"
    | "INACTIVITY_PAUSE_PROPOSAL"
    | "PLAN_ADJUSTMENT"
    | "WEEK_PREP"
    | "SESSION_PREP"
    | "WEEK_RECAP"
    | "INACTIVITY_CHECKIN"
    | "CELEBRATION";
  planIds: string[];
};

type PlanMotivatorInsight = {
  planId: string;
  goal: string;
  selectedReason: string | null;
  discardedReasons: string[];
  coachNotesExcerpt: string | null;
};

type DifficultyPatternInsight = {
  planId: string;
  goal: string;
  totalReports: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  latestDifficulty: string | null;
  severity: "easy" | "hard" | "mixed";
  summary: string;
};

type MetricsLoggingGapInsight = {
  metricCount: number;
  entriesInLookback: number;
  daysSinceLastLog: number | null;
  shouldNudge: boolean;
  summary: string;
};

export type CoachContextBrief = {
  generatedAt: string;
  lookbackDays: number;
  planMotivators: PlanMotivatorInsight[];
  difficultyPatterns: DifficultyPatternInsight[];
  metricsLoggingGap: MetricsLoggingGapInsight | null;
  metricPatterns: [];
};

export type SelectedCoachInsight = {
  kind: "goal_reason" | "difficulty_pattern" | "metrics_logging_gap";
  text: string;
} | null;

class CoachContextBriefService {
  async buildCoachContextBrief(input: {
    user: User;
    plans: CoachPlan[];
    now: Date;
    lookbackDays?: number;
  }): Promise<CoachContextBrief> {
    const { user, plans, now } = input;
    const lookbackDays = input.lookbackDays ?? 14;
    const from = subDays(now, lookbackDays);
    const planActivityIds = Array.from(
      new Set(plans.flatMap((plan) => plan.activities.map((activity) => activity.id)))
    );

    const [activityEntries, metrics, metricEntriesInLookback, latestMetricEntry] =
      await Promise.all([
        planActivityIds.length > 0
          ? prisma.activityEntry.findMany({
              where: {
                userId: user.id,
                deletedAt: null,
                activityId: { in: planActivityIds },
                datetime: { gte: from, lte: now },
                difficulty: { not: null },
              },
              orderBy: { datetime: "desc" },
            })
          : [],
        prisma.metric.findMany({
          where: { userId: user.id },
          select: { id: true },
        }),
        prisma.metricEntry.findMany({
          where: {
            userId: user.id,
            createdAt: { gte: from, lte: now },
          },
          select: { id: true },
        }),
        prisma.metricEntry.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

    return {
      generatedAt: now.toISOString(),
      lookbackDays,
      planMotivators: plans.map((plan) => ({
        planId: plan.id,
        goal: plan.goal,
        selectedReason: plan.goalReason?.trim() || null,
        discardedReasons: this.extractDiscardedReasons(plan.coachNotes),
        coachNotesExcerpt: this.extractRelevantCoachNotes(plan.coachNotes),
      })),
      difficultyPatterns: plans
        .map((plan) => {
          const planActivityIdsSet = new Set(plan.activities.map((activity) => activity.id));
          const planEntries = activityEntries.filter(
            (entry) => entry.activityId && planActivityIdsSet.has(entry.activityId)
          );
          return this.buildDifficultyPattern(plan, planEntries);
        })
        .filter((pattern): pattern is DifficultyPatternInsight => pattern !== null),
      metricsLoggingGap: this.buildMetricsLoggingGap({
        metricCount: metrics.length,
        entriesInLookback: metricEntriesInLookback.length,
        latestMetricCreatedAt: latestMetricEntry?.createdAt ?? null,
        now,
        lookbackDays,
      }),
      metricPatterns: [],
    };
  }

  pickInsightForCandidate(input: {
    candidate: CoachContextBriefCandidate;
    brief: CoachContextBrief;
  }): SelectedCoachInsight {
    const { candidate, brief } = input;
    const planIds = new Set(candidate.planIds);
    const relevantDifficulty = brief.difficultyPatterns.find((pattern) =>
      planIds.has(pattern.planId)
    );
    const relevantMotivator = brief.planMotivators.find(
      (motivator) =>
        planIds.has(motivator.planId) &&
        (motivator.selectedReason || motivator.discardedReasons.length > 0)
    );

    switch (candidate.type) {
      case "PLAN_ADJUSTMENT":
        return (
          this.formatDifficultyInsight(relevantDifficulty) ||
          this.formatMotivatorInsight(relevantMotivator)
        );
      case "SESSION_PREP":
      case "INACTIVITY_ARCHIVE_PROPOSAL":
      case "INACTIVITY_PAUSE_PROPOSAL":
      case "INACTIVITY_CHECKIN":
        return (
          this.formatMotivatorInsight(relevantMotivator) ||
          this.formatDifficultyInsight(relevantDifficulty)
        );
      case "WEEK_PREP":
      case "WEEK_RECAP":
        return (
          this.formatMetricsLoggingGapInsight(brief.metricsLoggingGap) ||
          this.formatDifficultyInsight(relevantDifficulty) ||
          this.formatMotivatorInsight(relevantMotivator)
        );
      case "CELEBRATION":
        return (
          this.formatMotivatorInsight(relevantMotivator) ||
          this.formatMetricsLoggingGapInsight(brief.metricsLoggingGap)
        );
      default:
        return null;
    }
  }

  formatSelectedInsight(insight: SelectedCoachInsight): string {
    if (!insight) return "";

    return [
      "",
      "Coach context brief - selected insight:",
      insight.text,
      "Use at most this one personal insight if it naturally strengthens the message. Ignore it if it distracts from the intervention. Do not mention the brief itself.",
    ].join("\n");
  }

  private buildDifficultyPattern(
    plan: CoachPlan,
    entries: Array<{ difficulty: string | null; datetime: Date }>
  ): DifficultyPatternInsight | null {
    const difficulties = entries
      .map((entry) => entry.difficulty)
      .filter((difficulty): difficulty is string => Boolean(difficulty));

    if (difficulties.length < 2) return null;

    const easyCount = difficulties.filter((difficulty) =>
      ["very_easy", "easy"].includes(difficulty)
    ).length;
    const mediumCount = difficulties.filter(
      (difficulty) => difficulty === "moderate"
    ).length;
    const hardCount = difficulties.filter((difficulty) =>
      ["hard", "very_hard"].includes(difficulty)
    ).length;

    let severity: DifficultyPatternInsight["severity"] = "mixed";
    if (hardCount >= 2 && hardCount / difficulties.length >= 0.6) {
      severity = "hard";
    } else if (easyCount >= 2 && easyCount / difficulties.length >= 0.6) {
      severity = "easy";
    }

    if (severity === "mixed" && difficulties.length < 4) return null;

    const latestDifficulty = entries[0]?.difficulty ?? null;
    const summary =
      severity === "hard"
        ? `${hardCount} of the last ${difficulties.length} difficulty reports were hard.`
        : severity === "easy"
          ? `${easyCount} of the last ${difficulties.length} difficulty reports were easy.`
          : `Recent difficulty reports are mixed: ${easyCount} easy, ${mediumCount} moderate, ${hardCount} hard.`;

    return {
      planId: plan.id,
      goal: plan.goal,
      totalReports: difficulties.length,
      easyCount,
      mediumCount,
      hardCount,
      latestDifficulty,
      severity,
      summary,
    };
  }

  private buildMetricsLoggingGap(input: {
    metricCount: number;
    entriesInLookback: number;
    latestMetricCreatedAt: Date | null;
    now: Date;
    lookbackDays: number;
  }): MetricsLoggingGapInsight | null {
    const {
      metricCount,
      entriesInLookback,
      latestMetricCreatedAt,
      now,
      lookbackDays,
    } = input;

    if (metricCount === 0) return null;

    const daysSinceLastLog = latestMetricCreatedAt
      ? differenceInCalendarDays(now, latestMetricCreatedAt)
      : null;
    const shouldNudge =
      entriesInLookback === 0 &&
      (daysSinceLastLog === null || daysSinceLastLog >= lookbackDays);

    return {
      metricCount,
      entriesInLookback,
      daysSinceLastLog,
      shouldNudge,
      summary:
        daysSinceLastLog === null
          ? `The user tracks ${metricCount} metric${metricCount === 1 ? "" : "s"} but has never logged a metric entry.`
          : `The user tracks ${metricCount} metric${metricCount === 1 ? "" : "s"} but has not logged any metric entries for ${daysSinceLastLog} days.`,
    };
  }

  private formatDifficultyInsight(
    insight: DifficultyPatternInsight | undefined
  ): SelectedCoachInsight {
    if (!insight) return null;

    const instruction =
      insight.severity === "hard"
        ? "Use this as evidence that the plan may need less friction or a smaller next step."
        : insight.severity === "easy"
          ? "Use this as evidence that the user may be ready for a confident next step, without overloading them."
          : "Use this as evidence that the plan needs a realistic next step, not a generic push.";

    return {
      kind: "difficulty_pattern",
      text: `For "${insight.goal}", ${insight.summary} ${instruction}`,
    };
  }

  private formatMotivatorInsight(
    insight: PlanMotivatorInsight | undefined
  ): SelectedCoachInsight {
    if (!insight) return null;

    if (insight.selectedReason) {
      return {
        kind: "goal_reason",
        text: `The user chose "${insight.goal}" because they want to ${this.normalizeReason(insight.selectedReason)}. Use this as the motivational anchor only if it fits naturally.`,
      };
    }

    if (insight.discardedReasons.length > 0) {
      return {
        kind: "goal_reason",
        text: `The user did not select these suggested reasons for "${insight.goal}": ${insight.discardedReasons.join("; ")}. Treat them as weak context only; do not pretend they are the user's stated why.`,
      };
    }

    return null;
  }

  private formatMetricsLoggingGapInsight(
    insight: MetricsLoggingGapInsight | null
  ): SelectedCoachInsight {
    if (!insight?.shouldNudge) return null;

    return {
      kind: "metrics_logging_gap",
      text: `${insight.summary} If it fits naturally, ask for one simple metric check-in this week so future coaching has better telemetry. Do not make it the main task.`,
    };
  }

  private extractDiscardedReasons(coachNotes: string | null): string[] {
    if (!coachNotes) return [];

    const match = coachNotes.match(/Suggested reasons not selected:\s*([^\n]+)/i);
    if (!match) return [];

    return match[1]
      .split(";")
      .map((reason) => reason.trim())
      .filter(Boolean);
  }

  private extractRelevantCoachNotes(coachNotes: string | null): string | null {
    if (!coachNotes) return null;
    const trimmed = coachNotes.trim();
    if (!trimmed) return null;
    return trimmed.length > 300 ? `${trimmed.slice(0, 297)}...` : trimmed;
  }

  private normalizeReason(value: string): string {
    const normalized = value.trim().replace(/^to\s+/i, "");
    if (!normalized) return normalized;
    return normalized[0].toLowerCase() + normalized.slice(1);
  }
}

export const coachContextBriefService = new CoachContextBriefService();
