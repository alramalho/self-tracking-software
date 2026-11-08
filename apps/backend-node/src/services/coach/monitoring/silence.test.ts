import { describe, expect, it } from "vitest";
import { unansweredOutreaches } from "./silence";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 19, 9, minutes));
const coach = (minutes: number, source: string | null, coachRequestId?: string) => ({
  role: "COACH",
  createdAt: at(minutes),
  metadata: source ? { source, coachRequestId } : {},
});
const user = (minutes: number) => ({ role: "USER", createdAt: at(minutes), metadata: null });

describe("unansweredOutreaches", () => {
  it("counts proactive outreaches since the person last wrote", () => {
    expect(
      unansweredOutreaches([
        coach(0, "plan_monitoring", "review:a"),
        user(5),
        coach(10, "plan_monitoring", "review:b"),
        coach(30, "autonomous_coach"),
      ]),
    ).toBe(2);
  });

  it("counts a multi-bubble outreach once and ignores replies to the person", () => {
    expect(
      unansweredOutreaches([
        user(0),
        coach(1, null),
        coach(2, null),
        coach(10, "plan_monitoring", "review:a"),
        coach(10, "plan_monitoring", "review:a"),
      ]),
    ).toBe(1);
  });

  it("is zero once the person answers", () => {
    expect(unansweredOutreaches([coach(0, "plan_monitoring", "review:a"), user(1)])).toBe(0);
  });
});
