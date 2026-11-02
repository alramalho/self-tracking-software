import { expect, it } from "vitest";
import { decideMonitoring, MAX_PAID_ATTEMPTS, monitoringState } from "./model";
import type { MonitoringInput } from "./types";

const reviewDue = () =>
  ({
    now: new Date("2026-09-27T18:07:00Z"),
    entitled: true,
    state: monitoringState(),
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
          followUps: false,
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
  }) as unknown as MonitoringInput;

it("retries a paid review until its attempts are used, then settles it without sending", () => {
  const input = reviewDue();
  const review = decideMonitoring(input);
  expect(review).toMatchObject({ id: "review:2026-09-27:running", kind: "review" });

  input.state.attempts = { [review!.id]: { count: MAX_PAID_ATTEMPTS - 1, at: input.now.toISOString() } };
  expect(decideMonitoring(input)?.id).toBe(review!.id);

  input.state.attempts[review!.id].count = MAX_PAID_ATTEMPTS;
  expect(decideMonitoring(input)).toBeNull();
  expect(input.state.reviewed.running).toBe("2026-09-27");
  expect(input.state.requests).toContainEqual(
    expect.objectContaining({ id: review!.id, kind: "review", requiresReply: false, closedAt: input.now.toISOString() }),
  );
  // Settled: the next hour does not come back to it.
  input.now = new Date("2026-09-27T19:07:00Z");
  expect(decideMonitoring(input)).toBeNull();
});

it("settles an exhausted plan setup so it stops being retried every hour", () => {
  const input = reviewDue();
  input.state.setupPlanIds = ["running"];
  const setup = decideMonitoring(input);
  expect(setup).toMatchObject({ kind: "setup", planIds: ["running"] });
  input.state.attempts = { [setup!.id]: { count: MAX_PAID_ATTEMPTS, at: input.now.toISOString() } };
  // Setup gives up, then the same run moves on to the review that is due.
  expect(decideMonitoring(input)?.kind).toBe("review");
  expect(input.state.setupPlanIds).toEqual([]);
});
