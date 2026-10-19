import { expect, it } from "vitest";
import { decideMonitoring, monitoringState } from "./model";
import type { MonitoringInput, MonitoringMessage } from "./types";

// Sunday review hour, 18:00 UTC.
const now = new Date("2026-10-18T18:07:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000);

function weeklyReviewInput(messages: MonitoringMessage[]) {
  return {
    now,
    entitled: true,
    state: monitoringState(),
    plans: [
      {
        id: "gym",
        goal: "Gym 3x a week",
        isPaused: false,
        archivedAt: null,
        deletedAt: null,
        finishingDate: null,
        activityIds: ["lift"],
        // Started recently at once a week, so the plan is not "slipping" into a silent nudge.
        timesPerWeek: 1,
        createdAt: daysAgo(3),
      },
    ],
    supports: {
      gym: {
        coaching: {
          role: "consistency",
          followUps: true,
          dataAccess: { workouts: false, sleep: false },
        },
        timezone: "UTC",
        preferences: {
          coaching: true,
          weeklyReview: true,
          reviewDay: 0,
          reviewTime: "18:00",
        },
      },
    },
    entries: [],
    messages,
    sessions: [],
  } as unknown as MonitoringInput;
}

const outreach = (id: string, days: number): MonitoringMessage => ({
  id,
  role: "COACH",
  planId: null,
  createdAt: daysAgo(days),
  metadata: { source: "plan_monitoring", coachRequestId: id },
});

it("does not open a new review while two outreaches sit unanswered", () => {
  const input = weeklyReviewInput([outreach("review:1", 14), outreach("lapse:1", 7)]);
  expect(decideMonitoring(input)).toBeNull();
});

it("reviews again once the person has written back", () => {
  const input = weeklyReviewInput([
    outreach("review:1", 14),
    outreach("lapse:1", 7),
    { id: "hi", role: "USER", planId: null, createdAt: daysAgo(2), metadata: null },
  ]);
  expect(decideMonitoring(input)).toMatchObject({ kind: "review", planIds: ["gym"] });
});

it("reopens a plan whose contact paused when the person logs it again", () => {
  const input = weeklyReviewInput([]);
  input.state.pausedPlanIds = ["gym"];
  input.state.requests.push({
    id: "review:old",
    kind: "review",
    planIds: ["gym"],
    createdAt: daysAgo(20).toISOString(),
    closedAt: daysAgo(13).toISOString(),
    requiresReply: true,
  });
  expect(decideMonitoring(input)).toBeNull();
  input.entries.push({
    id: "e1",
    activityId: "lift",
    datetime: daysAgo(1),
    updatedAt: daysAgo(1),
    difficulty: null,
    privateNotes: null,
    source: "MANUAL",
  });
  expect(decideMonitoring(input)).toMatchObject({ kind: "review" });
  expect(input.state.pausedPlanIds).toEqual([]);
});
