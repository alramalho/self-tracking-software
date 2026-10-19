import { tool } from "../../../../utils/aiSdk";
import dedent from "dedent";
import { z } from "zod/v4";
import type { OpenAgenda } from "../../agenda/types";
import type { ActiveCoachPlan } from "../../types";

type HeldPatch = {
  sessions?: { upsert?: { id?: string }[]; deleteIds?: string[] };
};

/** A change prepared days ago may point at sessions that have since moved or gone. */
function stillApplies(plan: ActiveCoachPlan | undefined, patch: unknown) {
  if (!plan) return false;
  const sessions = (patch as HeldPatch | null)?.sessions;
  const referenced = [
    ...(sessions?.upsert ?? []).flatMap((session) => (session.id ? [session.id] : [])),
    ...(sessions?.deleteIds ?? []),
  ];
  return referenced.every((id) => plan.sessions.some((session) => session.id === id));
}

/** Attaches a plan change the coach prepared during its last proactive review. */
export function createShareHeldProposalTool(agenda: OpenAgenda, plans: ActiveCoachPlan[]) {
  return tool({
    description: dedent`
      Attach a plan change you prepared before reaching out (listed under YOUR LAST OPENER) as a card the user can accept or decline.
      Use it only once the user has told you what's going on, or asked for the change. Mention it in one short sentence; the card carries the details.
    `,
    inputSchema: z.object({
      ref: z.string().describe("The [ref] of the prepared change, exactly as listed."),
    }),
    execute: async ({ ref }) => {
      const held = agenda.proposals.find((item) => item.ref === ref);
      if (!held) return { success: false, error: "No prepared change with that ref." };
      if (held.shared) return { success: false, error: "That change was already shown to the user." };
      const plan = plans.find((item) => item.id === held.proposal.planId);
      if (!stillApplies(plan, held.proposal.patch))
        return {
          success: false,
          error: "The plan changed since you prepared this. Propose a fresh change with proposePlanModification if it is still needed.",
        };
      return { success: true, proposal: { ...held.proposal, heldFrom: held.ref } };
    },
  });
}
