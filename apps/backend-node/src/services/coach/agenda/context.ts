import dedent from "dedent";
import type { OpenAgenda } from "./types";

/** Tells the chat coach what its last opener was about and how to unfold it. */
export function formatOpenAgendaContext(agenda: OpenAgenda) {
  const proposals = agenda.proposals
    .map(
      ({ ref, proposal, shared }) =>
        `- [${ref}] ${proposal.planEmoji ?? ""} ${proposal.planGoal}: ${proposal.description}${shared ? " (already shown)" : ""}`,
    )
    .join("\n");

  return dedent`
    YOUR LAST OPENER AND WHAT IT WAS ABOUT (${agenda.createdAt.slice(0, 10)})
    You reached out first with: ${agenda.opener ? `"${agenda.opener}"` : "(opener not found)"}
    Your private notes, never paste them as-is:
    ${agenda.briefing}
    ${proposals ? `Plan changes you prepared, held back until now:\n${proposals}` : ""}

    How to use this, like a coach sitting down with them:
    - If the user is answering the opener, unfold it one step per reply: first what you noticed (one or two sentences), then ask what's going on, then, once you understand, suggest the change.
    - Listen first. If their answer changes the picture, drop or adjust the prepared change instead of pushing it.
    - Attach a prepared change with shareHeldProposal only after they've told you what's going on, or if they ask for it. Never attach one marked already shown.
    - If they're talking about something else, follow them. Don't force the agenda.
  `;
}
