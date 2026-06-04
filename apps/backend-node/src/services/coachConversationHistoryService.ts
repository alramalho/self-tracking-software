type ConversationHistoryMessage = {
  role: "user" | "assistant";
  content: string;
  imageAttachments?: ImageAttachment[];
};

type MessageForHistory = {
  role: string;
  content: string;
  metadata?: unknown;
};

type ImageAttachment = {
  url: string;
  mediaType: string;
  filename?: string;
};

const formatStatus = (status: unknown) =>
  typeof status === "string" && status.length > 0 ? status : "pending";

function getCoachProposalStateLines(metadata: unknown): string[] {
  const data = metadata as any;
  const lines: string[] = [];

  if (Array.isArray(data?.planCreationProposals)) {
    data.planCreationProposals.forEach((proposal: any) => {
      lines.push(
        `- plan creation "${proposal?.goal || "untitled"}": ${formatStatus(proposal?.status)}`
      );
    });
  }

  if (Array.isArray(data?.planProposals)) {
    data.planProposals.forEach((proposal: any) => {
      const label = proposal?.description || proposal?.planGoal || "plan modification";
      lines.push(`- plan modification "${label}": ${formatStatus(proposal?.status)}`);
    });
  }

  return lines;
}

export function toCoachConversationHistory(
  messages: MessageForHistory[]
): ConversationHistoryMessage[] {
  return messages.map((message) => {
    const role = message.role === "USER" ? "user" : "assistant";
    const data = message.metadata as any;
    const imageAttachments =
      role === "user" && Array.isArray(data?.imageAttachments)
        ? data.imageAttachments
        : undefined;
    const proposalStateLines =
      role === "assistant" ? getCoachProposalStateLines(message.metadata) : [];

    return {
      role,
      content:
        proposalStateLines.length > 0
          ? [
              message.content,
              "",
              "Internal proposal state from this message:",
              ...proposalStateLines,
            ].join("\n")
          : message.content,
      ...(imageAttachments?.length ? { imageAttachments } : {}),
    };
  }) as ConversationHistoryMessage[];
}
