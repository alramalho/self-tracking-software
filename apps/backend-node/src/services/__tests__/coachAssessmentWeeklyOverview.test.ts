import { describe, expect, it } from "vitest";
import { buildAssessmentWeeklyOverview } from "../coach/assessment/weeklyOverview";

describe("coach assessment weekly overview", () => {
  it("formats multiple plans as a visible week-first overview", () => {
    const overview = buildAssessmentWeeklyOverview({
      now: new Date("2026-07-02T12:00:00.000Z"),
      timezone: "Europe/Warsaw",
      plans: [
        {
          id: "plan_train",
          goal: "train 4 times a week",
          emoji: "🏃",
          outlineType: "TIMES_PER_WEEK",
          timesPerWeek: 4,
          currentWeekState: null,
          activities: [
            {
              id: "activity_run",
              title: "Run",
              emoji: "🏃",
              measure: "sessions",
            },
            {
              id: "activity_bike",
              title: "Bike",
              emoji: "🚴",
              measure: "km",
            },
          ],
          sessions: [],
        },
        {
          id: "plan_strength",
          goal: "strength 3 times a week",
          emoji: "💪",
          outlineType: "TIMES_PER_WEEK",
          timesPerWeek: 3,
          currentWeekState: null,
          activities: [
            {
              id: "activity_strength",
              title: "Strength",
              emoji: "💪",
              measure: "sessions",
            },
          ],
          sessions: [],
        },
        {
          id: "plan_cook",
          goal: "cook",
          emoji: "👨‍🍳",
          outlineType: "SPECIFIC",
          activities: [
            {
              id: "activity_cook",
              title: "Cooking",
              emoji: "👨‍🍳",
              measure: "sessions",
            },
          ],
          sessions: [
            {
              id: "session_cook_thu",
              activityId: "activity_cook",
              date: new Date("2026-07-02T00:00:00.000Z"),
              quantity: 1,
            },
            {
              id: "session_cook_fri",
              activityId: "activity_cook",
              date: new Date("2026-07-03T00:00:00.000Z"),
              quantity: 1,
            },
            {
              id: "session_cook_sat",
              activityId: "activity_cook",
              date: new Date("2026-07-04T00:00:00.000Z"),
              quantity: 1,
            },
            {
              id: "session_cook_next_mon",
              activityId: "activity_cook",
              date: new Date("2026-07-06T00:00:00.000Z"),
              quantity: 1,
            },
            {
              id: "session_cook_next_wed",
              activityId: "activity_cook",
              date: new Date("2026-07-08T00:00:00.000Z"),
              quantity: 1,
            },
            {
              id: "session_cook_next_fri",
              activityId: "activity_cook",
              date: new Date("2026-07-10T00:00:00.000Z"),
              quantity: 1,
            },
          ],
        },
      ],
      entries: [
        {
          activityId: "activity_run",
          datetime: new Date("2026-06-29T08:00:00.000Z"),
        },
        {
          activityId: "activity_run",
          datetime: new Date("2026-07-01T08:00:00.000Z"),
        },
        {
          activityId: "activity_run",
          datetime: new Date("2026-07-01T18:00:00.000Z"),
        },
        {
          activityId: "activity_strength",
          datetime: new Date("2026-07-01T09:00:00.000Z"),
        },
      ],
    });

    expect(overview).toContain("Visible weekly overview:");
    expect(overview).toContain("Today: 2026-07-02 (Thursday).");
    expect(overview).toContain(
      "- 🏃 train 4 times a week: 🏃 Run (sessions), 🚴 Bike (km)",
    );
    expect(overview).toContain("This week summary:");
    expect(overview).toContain("Window: 2026-06-28 to 2026-07-04.");
    expect(overview).toContain(
      "- 🏃 train 4 times a week: 2/4 completed days, 2 remaining, 3 open days left, tight, 1 spare day.",
    );
    expect(overview).toContain("  Completed days: Mon, Wed.");
    expect(overview).toContain("  Suggested flexible days: Thu, Sat.");
    expect(overview).toContain("- 👨‍🍳 cook: fixed sessions Thu, Fri, Sat.");
    expect(overview).toContain("Next week summary:");
    expect(overview).toContain("Window: 2026-07-05 to 2026-07-11.");
    expect(overview).toContain(
      "- 🏃 train 4 times a week: 0/4 completed days, 4 remaining, 7 open days left, on track.",
    );
    expect(overview).toContain("  Suggested flexible days: Sun, Tue, Thu, Sat.");
    expect(overview).toContain("- 👨‍🍳 cook: fixed sessions Mon, Wed, Fri.");
  });

  it("pins flexible days to dated sessions on times-per-week plans", () => {
    const overview = buildAssessmentWeeklyOverview({
      now: new Date("2026-07-02T12:00:00.000Z"),
      timezone: "Europe/Warsaw",
      plans: [
        {
          id: "plan_train",
          goal: "train 4 times a week",
          emoji: "💪",
          outlineType: "TIMES_PER_WEEK",
          timesPerWeek: 4,
          currentWeekState: null,
          activities: [
            {
              id: "activity_gym",
              title: "Gym",
              emoji: "🏋️",
              measure: "sessions",
            },
            {
              id: "activity_run",
              title: "Run",
              emoji: "🏃",
              measure: "kilometers",
            },
          ],
          sessions: [
            {
              id: "session_fri",
              activityId: "activity_run",
              date: new Date("2026-07-03T00:00:00.000Z"),
              quantity: 5,
            },
            {
              id: "session_sat",
              activityId: "activity_gym",
              date: new Date("2026-07-04T00:00:00.000Z"),
              quantity: 1,
            },
            {
              id: "session_next_tue",
              activityId: "activity_gym",
              date: new Date("2026-07-07T00:00:00.000Z"),
              quantity: 1,
            },
            {
              id: "session_next_fri",
              activityId: "activity_run",
              date: new Date("2026-07-10T00:00:00.000Z"),
              quantity: 5,
            },
          ],
        },
        {
          id: "plan_locked_full",
          goal: "stretch 4 times a week",
          emoji: "🧘",
          outlineType: "TIMES_PER_WEEK",
          timesPerWeek: 4,
          currentWeekState: null,
          activities: [
            {
              id: "activity_stretch",
              title: "Stretch",
              emoji: "🧘",
              measure: "sessions",
            },
          ],
          sessions: [
            {
              id: "session_stretch_thu",
              activityId: "activity_stretch",
              date: new Date("2026-07-02T00:00:00.000Z"),
              quantity: 1,
            },
            {
              id: "session_stretch_fri",
              activityId: "activity_stretch",
              date: new Date("2026-07-03T00:00:00.000Z"),
              quantity: 1,
            },
            {
              id: "session_stretch_sat",
              activityId: "activity_stretch",
              date: new Date("2026-07-04T00:00:00.000Z"),
              quantity: 1,
            },
          ],
        },
      ],
      entries: [
        {
          activityId: "activity_gym",
          datetime: new Date("2026-06-29T08:00:00.000Z"),
        },
        {
          activityId: "activity_gym",
          datetime: new Date("2026-07-01T08:00:00.000Z"),
        },
      ],
    });

    // 2 remaining over open Thu/Fri/Sat: an even spread would pick Thu, Sat —
    // the dated sessions pin Fri, Sat instead.
    expect(overview).toContain(
      "- 💪 train 4 times a week: 2/4 completed days, 2 remaining, 3 open days left, tight, 1 spare day.",
    );
    expect(overview).toContain("  Suggested flexible days: Fri, Sat.");
    // Next week: Tue and Fri pinned, the other 2 spread across open days.
    expect(overview).toContain("  Suggested flexible days: Mon, Tue, Thu, Fri.");
    // All open days pinned but 4 remaining: overflow still surfaces.
    expect(overview).toContain(
      "- 🧘 stretch 4 times a week: 0/4 completed days, 4 remaining, 3 open days left, overloaded by 1 session.",
    );
    expect(overview).toContain(
      "  Suggested flexible days: Thu, Fri, Sat, Sat (+1 overflow).",
    );
  });
});
