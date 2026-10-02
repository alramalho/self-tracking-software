import { describe, expect, it } from "vitest";
import type { ActiveCoachPlan } from "../../types";
import { getProposalPatch } from "../../../planProposalPatchService";
import { followUpMessage, setupMessage } from "./proposals";

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

  it("keeps a follow-up to existing plan modifications, including archive", () => {
    const draft = followUpMessage([plan], {
      message: "You said you want to put this aside. Archive it?",
      requiresReply: false,
      modifications: [],
      archives: [{ planId: plan.id, description: "Archive running" }],
    });
    expect(draft?.planCreationProposals).toBeUndefined();
    expect(getProposalPatch(draft?.planProposals?.[0])).toEqual({
      archive: true,
    });
    expect(() =>
      followUpMessage([plan], {
        message: "Change another plan",
        requiresReply: false,
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
    const draft = followUpMessage([{ ...plan, outlineType: "SPECIFIC" }], {
      message: "Two easy runs next week to recover.",
      requiresReply: false,
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
    expect(getProposalPatch(draft?.planProposals?.[0])).toEqual({
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
});
