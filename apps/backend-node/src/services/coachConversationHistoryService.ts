type ConversationHistoryMessage = {
  role: "system" | "user" | "assistant";
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

const formatMetadataValue = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

function getCoachProposalStateLines(metadata: unknown): string[] {
  const data = metadata as any;
  const lines: string[] = [];

  if (Array.isArray(data?.planCreationProposals)) {
    data.planCreationProposals.forEach((proposal: any) => {
      lines.push(
        [
          "- type: plan_creation",
          `goal: ${formatMetadataValue(proposal?.goal) || "untitled"}`,
          `status: ${formatStatus(proposal?.status)}`,
        ].join("; ")
      );
    });
  }

  if (Array.isArray(data?.planProposals)) {
    data.planProposals.forEach((proposal: any) => {
      const label = proposal?.description || proposal?.planGoal || "plan modification";
      lines.push(
        [
          "- type: plan_modification",
          `label: ${formatMetadataValue(label)}`,
          `status: ${formatStatus(proposal?.status)}`,
        ].join("; ")
      );
    });
  }

  if (Array.isArray(data?.activityEditProposals)) {
    data.activityEditProposals.forEach((proposal: any) => {
      const fromMeasure = proposal?.original?.measure;
      const toMeasure = proposal?.requested?.measure;
      const measureText =
        fromMeasure && toMeasure && fromMeasure !== toMeasure
          ? ` (${fromMeasure} -> ${toMeasure})`
          : "";
      lines.push(
        [
          "- type: activity_edit",
          `activity: ${formatMetadataValue(proposal?.activityName) || "activity"}${measureText}`,
          `status: ${formatStatus(proposal?.status)}`,
        ].join("; ")
      );
    });
  }

  if (Array.isArray(data?.activityLogProposals)) {
    data.activityLogProposals.forEach((proposal: any) => {
      const quantity = proposal?.quantity ?? "?";
      const measure = proposal?.activityMeasure || "units";
      lines.push(
        [
          "- type: activity_log",
          `activity: ${formatMetadataValue(proposal?.activityName) || "activity"}`,
          `quantity: ${quantity}`,
          `measure: ${formatMetadataValue(measure)}`,
          `date: ${formatMetadataValue(proposal?.date) || "unknown"}`,
          `status: ${formatStatus(proposal?.status)}`,
        ].join("; ")
      );
    });
  }

  return lines;
}

export function toCoachConversationHistory(
  messages: MessageForHistory[]
): ConversationHistoryMessage[] {
  return messages.flatMap((message) => {
    const role = message.role === "USER" ? "user" : "assistant";
    const data = message.metadata as any;
    const imageAttachments =
      role === "user" && Array.isArray(data?.imageAttachments)
        ? data.imageAttachments
        : undefined;
    const proposalStateLines =
      role === "assistant" ? getCoachProposalStateLines(message.metadata) : [];

    const visibleMessage = {
      role,
      content: message.content,
      ...(imageAttachments?.length ? { imageAttachments } : {}),
    };

    if (role !== "assistant" || proposalStateLines.length === 0) {
      return [visibleMessage];
    }

    return [
      visibleMessage,
      {
        role: "system",
        content: [
          "PRIOR APP STATE FOR THE IMMEDIATELY PRECEDING ASSISTANT MESSAGE.",
          "This is not transcript text and was not visible to the user.",
          "Use it only to understand persisted proposal state. Do not quote, imitate, or output it.",
          "previous_proposal_state:",
          ...proposalStateLines,
        ].join("\n"),
      },
    ];
  }) as ConversationHistoryMessage[];
}
