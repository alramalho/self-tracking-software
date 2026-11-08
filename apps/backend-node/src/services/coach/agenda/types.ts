import type { HeldPlanProposal } from "@tsw/prisma/follow-through";

export interface OpenAgendaProposal {
  /** Stable reference the coach passes back to attach it, e.g. "review:2026-10-19:abc#0". */
  ref: string;
  proposal: HeldPlanProposal;
  shared: boolean;
}

/** The latest proactive opener's held-back notes, available to the chat coach once the person replies. */
export interface OpenAgenda {
  requestId: string;
  createdAt: string;
  opener: string | null;
  briefing: string;
  proposals: OpenAgendaProposal[];
}
