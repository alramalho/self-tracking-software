import { describe, expect, it } from "vitest";
import { getProposalPatch } from "../../../planProposalPatchService";
import { windowDue, windowInput, windowMessage } from "./window";
import type { ScheduledCoachInput } from "./types";

const targets = {
  durationMinutes: 35,
  effort: "easy, can talk",
  pace: { minSecondsPerKm: 420, maxSecondsPerKm: 444, basis: "USER_REPORTED_EASY_PACE" as const, evidence: "easy 5 km in 35–37 min" },
  exercise: null,
  sets: null,
  reps: null,
  loadKg: null,
  restSeconds: null,
  progressMeasure: "Finish able to talk in sentences",
};
const plan = {
  id: "plan1",
  goal: "Finish my first half marathon",
  emoji: "🏃",
  orientation: "OUTCOME",
  goalSpec: null,
  baseline: { text: "Easy 5 km in 35–37 min", measurements: [] },
  outline: { route: "steady", coach: "Helly", phases: [], assumptions: [], daysMin: 3, daysMax: 3, startDate: "2026-10-05", estimatedWeeks: 20 },
  finishingDate: new Date("2027-02-21"),
  designedThrough: new Date("2026-10-18T12:00:00Z"),
  activities: [{ id: "run", title: "Running", measure: "km", emoji: "🏃" }],
  sessions: [
    { id: "a", activityId: "run", date: new Date("2026-10-12T12:00:00Z"), quantity: 4, title: "Easy run", targets },
    { id: "b", activityId: "run", date: new Date("2026-10-14T12:00:00Z"), quantity: 4, title: "Easy run", targets },
  ],
} as unknown as ScheduledCoachInput["plans"][number];

describe("rolling window", () => {
  it("is due when dated sessions end within a week, and only for coached outcome plans", () => {
    expect(windowDue(plan, "2026-10-10")).toBe(false); // 8 days left
    expect(windowDue(plan, "2026-10-11")).toBe(true); // 7 days left
    expect(windowDue({ ...plan, orientation: "CONSISTENCY" } as typeof plan, "2026-10-17")).toBe(false);
    expect(windowDue({ ...plan, designedThrough: null } as typeof plan, "2026-10-17")).toBe(false);
  });

  it("marks a session completed only when that activity was logged that day", () => {
    const input = {
      user: { timezone: "Europe/Lisbon" },
      now: new Date("2026-10-15T09:00:00Z"),
      entries: [{ id: "e1", activityId: "run", datetime: new Date("2026-10-12T18:00:00Z"), quantity: 4, difficulty: "hard", privateNotes: "legs heavy" }],
    } as unknown as ScheduledCoachInput;
    const built = windowInput(plan, input, null, null);
    expect(built.sessions.map((s) => [s.id, s.completed])).toEqual([["a", true], ["b", false]]);
    expect(built.results[0]).toMatchObject({ difficulty: "hard", note: "legs heavy" });
    expect(built.today).toBe("2026-10-15");
  });

  it("becomes one reviewable proposal that swaps sessions and moves the window", () => {
    const message = windowMessage(plan, {
      replaceSessionIds: ["b"],
      sessions: [{ date: "2026-10-19", activityId: "run", quantity: 5, title: "Long run", descriptiveGuide: "Easy long run, walk breaks are fine.", targets }],
      phases: [
        { title: "Base", startWeek: 1, endWeek: 4, progressCheck: "Run 5 km easy twice" },
        { title: "Build", startWeek: 5, endWeek: 20, progressCheck: "Long run reaches 15 km" },
      ],
      summary: "Held the distance after a hard week.",
      designedThrough: "2026-11-01",
      usage: { model: "x", inputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
    });
    expect(message.requiresReply).toBe(false);
    const patch = getProposalPatch(message.planProposals![0]);
    expect(patch.plan?.designedThrough).toBe("2026-11-01");
    expect(patch.sessions?.deleteIds).toEqual(["b"]);
    expect(patch.sessions?.upsert?.[0].targets?.pace?.basis).toBe("USER_REPORTED_EASY_PACE");
  });
});
