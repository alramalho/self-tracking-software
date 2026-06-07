import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { getPreviousCoachWeekBounds } from "../../utils/date";
import { deriveCoachAttentionItems } from "../coachAttentionService";
import { coachContextBriefService } from "../coachContextBriefService";
import { isWithinPreferredCoachWindow } from "../coachAssessmentService";

describe("coach assessment week bounds", () => {
  it("uses Sunday as the first day for previous-week recaps", () => {
    const { start, end } = getPreviousCoachWeekBounds(
      new Date("2026-06-01T11:24:00.000Z"),
      "Europe/Berlin"
    );

    expect(format(start, "yyyy-MM-dd")).toBe("2026-05-24");
    expect(format(end, "yyyy-MM-dd")).toBe("2026-05-30");
  });
});

describe("preferred coach window", () => {
  it("returns true within the 2-hour preferred interval", () => {
    expect(
      isWithinPreferredCoachWindow(
        { timezone: "Europe/Berlin", preferredCoachingHour: 6 },
        new Date("2026-05-19T04:30:00.000Z") // 6:30 Berlin
      )
    ).toBe(true);
  });

  it("returns false outside the preferred interval", () => {
    expect(
      isWithinPreferredCoachWindow(
        { timezone: "Europe/Berlin", preferredCoachingHour: 6 },
        new Date("2026-05-19T08:30:00.000Z") // 10:30 Berlin
      )
    ).toBe(false);
  });

  it("defaults to 6am when preferredCoachingHour is null", () => {
    expect(
      isWithinPreferredCoachWindow(
        { timezone: "UTC", preferredCoachingHour: null },
        new Date("2026-05-19T06:30:00.000Z")
      )
    ).toBe(true);

    expect(
      isWithinPreferredCoachWindow(
        { timezone: "UTC", preferredCoachingHour: null },
        new Date("2026-05-19T08:30:00.000Z")
      )
    ).toBe(false);
  });

  it("handles evening preferred hours", () => {
    expect(
      isWithinPreferredCoachWindow(
        { timezone: "America/New_York", preferredCoachingHour: 20 },
        new Date("2026-05-20T00:30:00.000Z") // 8:30pm ET
      )
    ).toBe(true);

    expect(
      isWithinPreferredCoachWindow(
        { timezone: "America/New_York", preferredCoachingHour: 20 },
        new Date("2026-05-20T02:30:00.000Z") // 10:30pm ET
      )
    ).toBe(false);
  });
});

describe("coach attention schedule rules", () => {
  const user = { timezone: "Europe/Lisbon" };
  const now = new Date("2026-06-07T10:00:00.000Z");

  function plan(overrides: Record<string, unknown>) {
    return {
      id: "plan_1",
      goal: "Deep learning",
      emoji: "🧠",
      outlineType: "SPECIFIC",
      finishingDate: new Date("2026-08-26T00:00:00.000Z"),
      deletedAt: null,
      archivedAt: null,
      isPaused: false,
      sessions: [],
      activities: [],
      milestones: [],
      ...overrides,
    } as any;
  }

  function session(date: string) {
    return {
      id: `session_${date}`,
      planId: "plan_1",
      activityId: "activity_1",
      date: new Date(`${date}T00:00:00.000Z`),
      quantity: 60,
      descriptiveGuide: "",
      isCoachSuggested: false,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      imageUrls: [],
    } as any;
  }

  it("flags active specific plans with no future sessions", () => {
    const items = deriveCoachAttentionItems({
      user,
      now,
      plans: [plan({ sessions: [session("2026-06-05")] })],
    });

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("SPECIFIC_NO_FUTURE_SESSIONS");
    expect(items[0].severity).toBe("critical");
  });

  it("flags active specific plans whose schedule ends this week", () => {
    const items = deriveCoachAttentionItems({
      user,
      now,
      plans: [plan({ sessions: [session("2026-06-08"), session("2026-06-12")] })],
    });

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("SPECIFIC_SCHEDULE_ENDING");
    expect(items[0].severity).toBe("warning");
  });

  it("does not flag times-per-week plans without sessions", () => {
    const items = deriveCoachAttentionItems({
      user,
      now,
      plans: [
        plan({
          outlineType: "TIMES_PER_WEEK",
          timesPerWeek: 4,
          sessions: [],
        }),
      ],
    });

    expect(items).toHaveLength(0);
  });

  it("does not flag inactive plans", () => {
    const items = deriveCoachAttentionItems({
      user,
      now,
      plans: [
        plan({
          archivedAt: new Date("2026-06-06T00:00:00.000Z"),
          sessions: [],
        }),
      ],
    });

    expect(items).toHaveLength(0);
  });
});

describe("coach context brief insight picker", () => {
  const baseBrief = {
    generatedAt: "2026-05-20T12:00:00.000Z",
    lookbackDays: 14,
    planMotivators: [
      {
        planId: "plan_1",
        goal: "Eat better",
        selectedReason: "Build self-esteem",
        discardedReasons: ["Have more energy"],
        coachNotesExcerpt:
          "Suggested reasons not selected: Have more energy",
      },
    ],
    difficultyPatterns: [
      {
        planId: "plan_1",
        goal: "Eat better",
        totalReports: 4,
        easyCount: 0,
        mediumCount: 1,
        hardCount: 3,
        latestDifficulty: "hard",
        severity: "hard" as const,
        summary: "3 of the last 4 difficulty reports were hard.",
      },
    ],
    metricsLoggingGap: {
      metricCount: 3,
      entriesInLookback: 0,
      daysSinceLastLog: 21,
      shouldNudge: true,
      summary:
        "The user tracks 3 metrics but has not logged any metric entries for 21 days.",
    },
    metricPatterns: [] as [],
  };

  it("prefers difficulty for plan adjustments", () => {
    const insight = coachContextBriefService.pickInsightForCandidate({
      candidate: { type: "PLAN_ADJUSTMENT", planIds: ["plan_1"] },
      brief: baseBrief,
    });

    expect(insight?.kind).toBe("difficulty_pattern");
    expect(insight?.text).toContain("3 of the last 4 difficulty reports");
  });

  it("prefers the selected goal reason for session prep", () => {
    const insight = coachContextBriefService.pickInsightForCandidate({
      candidate: { type: "SESSION_PREP", planIds: ["plan_1"] },
      brief: baseBrief,
    });

    expect(insight?.kind).toBe("goal_reason");
    expect(insight?.text).toContain("build self-esteem");
  });

  it("uses metrics logging gap for week prep", () => {
    const insight = coachContextBriefService.pickInsightForCandidate({
      candidate: { type: "WEEK_PREP", planIds: ["plan_1"] },
      brief: baseBrief,
    });

    expect(insight?.kind).toBe("metrics_logging_gap");
    expect(insight?.text).toContain("not logged any metric entries for 21 days");
  });
});
