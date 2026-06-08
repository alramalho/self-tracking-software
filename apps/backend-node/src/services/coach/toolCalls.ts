export type CoachToolCallRecord = {
  tool: string;
  args: unknown;
  result: unknown;
};

export function collectToolCallsFromSteps(steps: any[]): CoachToolCallRecord[] {
  const allToolCalls: CoachToolCallRecord[] = [];

  for (const step of steps) {
    if (!step.toolCalls) continue;

    for (const tc of step.toolCalls) {
      const toolResult = step.toolResults?.find(
        (tr: any) => tr.toolCallId === tc.toolCallId
      );
      allToolCalls.push({
        tool: tc.toolName,
        args: "input" in tc ? tc.input : undefined,
        result:
          toolResult && "output" in toolResult ? toolResult.output : undefined,
      });
    }
  }

  return allToolCalls;
}

export function getDraftToolCalls(toolCalls: CoachToolCallRecord[]) {
  return toolCalls.filter((toolCall) => toolCall.tool === "draftMessages");
}

export function getSuccessfulDraftCall(toolCalls: CoachToolCallRecord[]) {
  return [...getDraftToolCalls(toolCalls)]
    .reverse()
    .find((toolCall) => (toolCall.result as any)?.success === true);
}

export function getRepeatLimitDraftCall(toolCalls: CoachToolCallRecord[]) {
  return [...getDraftToolCalls(toolCalls)]
    .reverse()
    .find((toolCall) => (toolCall.result as any)?.repeatLimitExceeded === true);
}

export function getVisibleToolCalls(toolCalls: CoachToolCallRecord[]) {
  return toolCalls.filter((toolCall) => toolCall.tool !== "draftMessages");
}
