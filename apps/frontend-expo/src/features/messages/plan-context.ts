import type { Message } from "./types";

export function messagePlanIds(message: Message): string[] {
  return [
    ...new Set([
      ...(message.planId ? [message.planId] : []),
      ...(message.planIds ?? []),
      ...(message.planProposals?.map((p) => p.planId) ?? []),
      ...(message.planReplacements?.map((p) => p.plan.id) ?? []),
      ...Array.from(
        message.content.matchAll(/\{\{plan:([^|}]+)\|/g),
        (m) => m[1],
      ),
    ]),
  ];
}
