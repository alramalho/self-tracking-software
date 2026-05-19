import { describe, expect, it } from "vitest";
import {
  chooseCoachAssessmentDecision,
  isWithinPreferredCoachWindow,
  type CoachAssessmentSignal,
} from "../coachAssessmentService";

const baseSignal: CoachAssessmentSignal = {
  planId: "plan_1",
  planGoal: "Train consistently",
  planEmoji: "🏋️",
  daysSinceLastActivity: 3,
  entriesLast7Days: 0,
  entriesLast30Days: 3,
  missedSessionsLast7Days: 2,
  upcomingSessionsTomorrow: 0,
  reason: "missed_recent_sessions",
  urgency: "medium",
};

describe("coach assessment decision", () => {
  it("skips when there was a recent autonomous notification", () => {
    const decision = chooseCoachAssessmentDecision({
      signals: [baseSignal],
      pendingProposal: false,
      recentAutonomousNotification: true,
      inPreferredWindow: true,
    });

    expect(decision.action).toBe("skip");
    expect(decision.reason).toContain("Recent autonomous coach notification");
  });

  it("skips while a previous coach proposal is unresolved", () => {
    const decision = chooseCoachAssessmentDecision({
      signals: [baseSignal],
      pendingProposal: true,
      recentAutonomousNotification: false,
      inPreferredWindow: true,
    });

    expect(decision.action).toBe("skip");
    expect(decision.reason).toContain("unresolved coach proposal");
  });

  it("prefers archive suggestions for dormant plans", () => {
    const decision = chooseCoachAssessmentDecision({
      signals: [
        {
          ...baseSignal,
          daysSinceLastActivity: null,
          entriesLast7Days: 0,
          entriesLast30Days: 0,
          missedSessionsLast7Days: 0,
          reason: "dormant_plan",
          urgency: "high",
        },
      ],
      pendingProposal: false,
      recentAutonomousNotification: false,
      inPreferredWindow: false,
    });

    expect(decision.action).toBe("archive_suggestion");
    expect(decision.urgency).toBe("high");
  });

  it("waits for the preferred window for non-urgent missed sessions", () => {
    const decision = chooseCoachAssessmentDecision({
      signals: [baseSignal],
      pendingProposal: false,
      recentAutonomousNotification: false,
      inPreferredWindow: false,
    });

    expect(decision.action).toBe("skip");
    expect(decision.reason).toContain("preferred coach check-in window");
  });

  it("suggests plan changes for recent misses inside the preferred window", () => {
    const decision = chooseCoachAssessmentDecision({
      signals: [baseSignal],
      pendingProposal: false,
      recentAutonomousNotification: false,
      inPreferredWindow: true,
    });

    expect(decision.action).toBe("plan_change");
    expect(decision.reason).toContain("Recent planned sessions were missed");
  });

  it("allows pre-activity check-ins outside the preferred window", () => {
    const decision = chooseCoachAssessmentDecision({
      signals: [
        {
          ...baseSignal,
          reason: "upcoming_session",
          urgency: "low",
          missedSessionsLast7Days: 0,
          upcomingSessionsTomorrow: 1,
        },
      ],
      pendingProposal: false,
      recentAutonomousNotification: false,
      inPreferredWindow: false,
    });

    expect(decision.action).toBe("pre_activity");
  });

  it("skips when there are no meaningful coach signals", () => {
    const decision = chooseCoachAssessmentDecision({
      signals: [],
      pendingProposal: false,
      recentAutonomousNotification: false,
      inPreferredWindow: true,
    });

    expect(decision.action).toBe("skip");
    expect(decision.reason).toContain("No meaningful coach signal");
  });

  it("sends a weekly recap when weekly recap is the best signal", () => {
    const decision = chooseCoachAssessmentDecision({
      signals: [
        {
          ...baseSignal,
          reason: "weekly_recap",
          urgency: "low",
          missedSessionsLast7Days: 0,
        },
      ],
      pendingProposal: false,
      recentAutonomousNotification: false,
      inPreferredWindow: true,
    });

    expect(decision.action).toBe("weekly_recap");
  });
});

describe("preferred coach window", () => {
  it("uses the user's timezone and two-hour preferred interval", () => {
    expect(
      isWithinPreferredCoachWindow(
        { timezone: "Europe/Berlin", preferredCoachingHour: 6 },
        new Date("2026-05-19T04:30:00.000Z")
      )
    ).toBe(true);

    expect(
      isWithinPreferredCoachWindow(
        { timezone: "Europe/Berlin", preferredCoachingHour: 6 },
        new Date("2026-05-19T08:30:00.000Z")
      )
    ).toBe(false);
  });
});
