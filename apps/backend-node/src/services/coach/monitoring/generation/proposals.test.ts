import { describe, expect, it } from "vitest";
import type { ActiveCoachPlan } from "../../types";
import { getProposalPatch } from "../../../planProposalPatchService";
import { followUpOpening, setupMessage } from "./proposals";

const plan = {
  id: "running-plan",
  goal: "Run a half marathon",
  emoji: "🏃",
  activities: [{ id: "running", title: "Running", measure: "km" }],
  sessions: [{ id: "monday", activityId: "running" }],
} as ActiveCoachPlan;

describe("scheduled coach proposal boundary", () => {
  it("turns a first-week design into a proposal for the existing plan", () => {
    const draft = setupMessage(plan, {
      message: "Here is a gentle first week to review.",
      requiresReply: false,
      sessions: [
        {
          activityId: "running",
          date: "2026-09-28",
          quantity: 3,
          descriptiveGuide: "Easy conversational run.",
        },
      ],
      alsoTrack: [],
    });
    expect(draft.planCreationProposals).toBeUndefined();
    expect(draft.planProposals?.[0].planId).toBe(plan.id);
    expect(getProposalPatch(draft.planProposals?.[0])).toEqual({
      plan: { outlineType: "SPECIFIC" },
      sessions: {
        upsert: [
          {
            activityId: "running",
            date: "2026-09-28",
            quantity: 3,
            descriptiveGuide: "Easy conversational run.",
          },
        ],
      },
    });
  });

  it("asks to also track a measurement the plan's activities don't capture, once", () => {
    const draft = setupMessage(plan, {
      message: "Log your weight every Monday morning so we can see the trend.",
      requiresReply: false,
      sessions: [
        { activityId: "running", date: "2026-09-28", quantity: 3, descriptiveGuide: "Easy run." },
      ],
      alsoTrack: [
        { title: "Weight", measure: "kg", emoji: "⚖️" },
        { title: "Waist", measure: "cm", emoji: "weight_1" },
        { title: "running", measure: "km", emoji: "🏃" },
      ],
    });
    expect(getProposalPatch(draft.planProposals?.[0])?.track).toEqual([
      { title: "Weight", measure: "kg", emoji: "⚖️" },
      { title: "Waist", measure: "cm", emoji: "📏" },
    ]);
  });

  it("knocks first: posts only the opener and holds plan changes, including archive", () => {
    const opening = followUpOpening([plan], {
      opener: "Hey, sounds like running is on hold. Still want it?",
      agenda: "Said last week they want to put running aside.",
      modifications: [],
      archives: [{ planId: plan.id, description: "Archive running" }],
    });
    expect(opening?.draft).toEqual({
      content: "Hey, sounds like running is on hold. Still want it?",
      requiresReply: true,
    });
    expect(opening?.agenda.briefing).toBe("Said last week they want to put running aside.");
    expect(opening?.agenda.proposals[0].patch).toEqual({ archive: true });
    expect(opening?.agenda.proposals[0]).not.toHaveProperty("status");
    expect(() =>
      followUpOpening([plan], {
        opener: "Change another plan",
        agenda: null,
        modifications: [
          {
            planId: "other-plan",
            description: "Change target",
            timesPerWeek: 2,
            newSessions: [],
            revisedSessions: [],
            removeSessionIds: [],
          },
        ],
        archives: [],
      }),
    ).toThrow();
  });

  it("keeps a temporary lighter week out of the ongoing target", () => {
    const opening = followUpOpening([{ ...plan, outlineType: "SPECIFIC" }], {
      opener: "That last run sounded rough. How are the legs?",
      agenda: "Hard run Tuesday; suggest two easy runs next week.",
      modifications: [
        {
          planId: plan.id,
          description: "Lighter week",
          timesPerWeek: null,
          newSessions: [
            {
              activityId: "running",
              date: "2026-09-29",
              quantity: 2,
              descriptiveGuide: "Easy 2 km.",
            },
          ],
          revisedSessions: [],
          removeSessionIds: [],
        },
      ],
      archives: [],
    });
    expect(opening?.agenda.proposals[0].patch).toEqual({
      sessions: {
        upsert: [
          {
            activityId: "running",
            date: "2026-09-29",
            quantity: 2,
            descriptiveGuide: "Easy 2 km.",
          },
        ],
      },
    });
  });

  it("stays quiet when there is nothing worth opening a conversation about", () => {
    expect(
      followUpOpening([plan], { opener: null, agenda: null, modifications: [], archives: [] }),
    ).toBeNull();
  });
});
