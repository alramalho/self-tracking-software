import { expect, it } from "vitest";
import { decideMonitoring, monitoringState } from "./model";
import type { MonitoringInput } from "./types";

it("waits for a missing-baseline answer, then resumes the same first-week design", () => {
  const now = new Date("2026-09-27T18:07:00Z");
  const state = monitoringState();
  state.setupPlanIds = ["running"];
  state.requests.push({
    id: "setup:running",
    kind: "setup",
    planIds: ["running"],
    createdAt: "2026-09-27T17:07:00Z",
    requiresReply: true,
  });
  const input = {
    now,
    entitled: true,
    state,
    plans: [
      {
        id: "running",
        goal: "Run a half marathon",
        isPaused: false,
        archivedAt: null,
        deletedAt: null,
        finishingDate: null,
        activityIds: ["run"],
      },
    ],
    supports: {
      running: {
        coaching: {
          role: "training",
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
    messages: [],
    sessions: [],
  } as unknown as MonitoringInput;
  expect(decideMonitoring(input)).toBeNull();
  input.messages.push({
    id: "reply",
    role: "USER",
    planId: "running",
    createdAt: new Date("2026-09-27T18:00:00Z"),
    metadata: null,
  });
  expect(decideMonitoring(input)).toBeNull();
  input.messages[0].createdAt = new Date("2026-09-27T17:30:00Z");
  expect(decideMonitoring(input)).toMatchObject({
    kind: "setup",
    planIds: ["running"],
  });
});
