import { z } from "zod/v4";

export type ProposalKind = "planCreation" | "planModification" | "activityLog";

export type ArtifactSource =
  | "planCreationProposal"
  | "planModificationProposal"
  | "activityLogProposal";

export type CoachEvalTest = {
  id: string;
  name: string;
  skip?: boolean | string;
  only?: boolean;
  userMessage: string;
  fixture: CoachEvalFixture;
  verify: (ctx: CoachEvalContext) => Promise<VerifyResult[]> | VerifyResult[];
};

export type CoachEvalFixture = {
  user: Record<string, any>;
  plans?: Array<Record<string, any>>;
  activityEntries?: Array<Record<string, any>>;
  reminders?: Array<Record<string, any>>;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  memoriesContext?: string | null;
};

export type CoachEvalArtifacts = {
  toolCalls: Array<{ tool: string; args: unknown; result: unknown }>;
  planCreationProposals: unknown[];
  planModificationProposals: unknown[];
  activityLogProposals: unknown[];
};

export type CoachEvalContext = {
  testId: string;
  testName: string;
  userMessage: string;
  responseText: string;
  artifacts: CoachEvalArtifacts;
  skipJudge: boolean;
  judgeModel: string;
  aiService: any;
};

export type VerifyResult = {
  id: string;
  kind: "deterministic" | "judge";
  pass: boolean;
  detail: string;
  skipped?: boolean;
};

export type CoachEvalRunResult = {
  testId: string;
  testName: string;
  model: string;
  run: number;
  latencyMs: number;
  costUsd?: number;
  usage?: Record<string, unknown>;
  stepCount?: number;
  pass: boolean;
  deterministicPass: boolean;
  judgePass?: boolean;
  verifyResults: VerifyResult[];
  responseText: string;
  artifacts: CoachEvalArtifacts;
  error?: string;
};

export type CoachEvalSummaryRow = {
  model: string;
  runs: number;
  passRate: number;
  deterministicPassRate: number;
  judgePassRate?: number;
  avgLatencyMs: number;
  totalCostUsd?: number;
};

export function allOf(...results: Array<VerifyResult | VerifyResult[]>): VerifyResult[] {
  return results.flat();
}

export function toolCalled(ctx: CoachEvalContext, tool: string): VerifyResult {
  const pass = ctx.artifacts.toolCalls.some((toolCall) => toolCall.tool === tool);
  return {
    id: `tool_called:${tool}`,
    kind: "deterministic",
    pass,
    detail: pass ? `${tool} was called` : `${tool} was not called`,
  };
}

export function toolsNotCalled(ctx: CoachEvalContext, tools: string[]): VerifyResult[] {
  return tools.map((tool) => {
    const pass = !ctx.artifacts.toolCalls.some((toolCall) => toolCall.tool === tool);
    return {
      id: `tool_not_called:${tool}`,
      kind: "deterministic" as const,
      pass,
      detail: pass ? `${tool} was not called` : `${tool} was called`,
    };
  });
}

export function proposalCount(
  ctx: CoachEvalContext,
  proposal: ProposalKind,
  expected: { equals?: number; min?: number; max?: number }
): VerifyResult {
  const count = proposalList(ctx.artifacts, proposal).length;
  const equalsPass = expected.equals === undefined || count === expected.equals;
  const minPass = expected.min === undefined || count >= expected.min;
  const maxPass = expected.max === undefined || count <= expected.max;

  return {
    id: `proposal_count:${proposal}`,
    kind: "deterministic",
    pass: equalsPass && minPass && maxPass,
    detail: `${proposal} count was ${count}`,
  };
}

export function responseMatches(
  ctx: CoachEvalContext,
  pattern: RegExp,
  id = `response_matches:${pattern.source}`
): VerifyResult {
  const pass = pattern.test(ctx.responseText);
  return {
    id,
    kind: "deterministic",
    pass,
    detail: pass ? "pattern matched" : "pattern did not match",
  };
}

export function responseNotMatches(
  ctx: CoachEvalContext,
  pattern: RegExp,
  id = `response_not_matches:${pattern.source}`
): VerifyResult {
  const pass = !pattern.test(ctx.responseText);
  return {
    id,
    kind: "deterministic",
    pass,
    detail: pass ? "forbidden pattern did not match" : "forbidden pattern matched",
  };
}

export function jsonPathEquals(
  ctx: CoachEvalContext,
  source: ArtifactSource,
  pathExpression: string,
  expected: unknown
): VerifyResult {
  const actual = getByPath(sourceValue(ctx.artifacts, source), pathExpression);
  return {
    id: `json_path_equals:${source}.${pathExpression}`,
    kind: "deterministic",
    pass: actual === expected,
    detail: `${source}.${pathExpression} was ${formatValue(actual)}`,
  };
}

export function jsonPathIncludes(
  ctx: CoachEvalContext,
  source: ArtifactSource,
  pathExpression: string,
  expectedSubstring: string
): VerifyResult {
  const actual = getByPath(sourceValue(ctx.artifacts, source), pathExpression);
  const pass = formatValue(actual || "")
    .toLowerCase()
    .includes(expectedSubstring.toLowerCase());

  return {
    id: `json_path_includes:${source}.${pathExpression}`,
    kind: "deterministic",
    pass,
    detail: `${source}.${pathExpression} was ${formatValue(actual)}`,
  };
}

export function arrayLengthAtLeast(
  ctx: CoachEvalContext,
  source: ArtifactSource,
  pathExpression: string,
  min: number
): VerifyResult {
  const actual = getByPath(sourceValue(ctx.artifacts, source), pathExpression);
  const count = Array.isArray(actual) ? actual.length : 0;
  return {
    id: `array_length_at_least:${source}.${pathExpression}`,
    kind: "deterministic",
    pass: count >= min,
    detail: `${source}.${pathExpression} length was ${count}`,
  };
}

export async function llmJudge(
  ctx: CoachEvalContext,
  ...criteria: string[]
): Promise<VerifyResult[]> {
  if (ctx.skipJudge || criteria.length === 0) {
    return [
      {
        id: "llm_judge",
        kind: "judge",
        pass: true,
        skipped: true,
        detail: "skipped",
      },
    ];
  }

  const EvaluationSchema = z.object({
    results: z.array(
      z.object({
        criterion: z.string(),
        pass: z.boolean(),
        reasoning: z.string(),
      })
    ),
  });

  const prompt = [
    "Evaluate this coach response against the listed criteria.",
    "Be strict. A criterion only passes if the response and attached artifacts clearly satisfy it.",
    "",
    `Test: ${ctx.testName}`,
    `User message: ${ctx.userMessage}`,
    "",
    "Coach visible response:",
    ctx.responseText,
    "",
    "Attached artifacts:",
    JSON.stringify(ctx.artifacts, null, 2),
    "",
    "Criteria:",
    criteria.map((criterion, index) => `${index + 1}. ${criterion}`).join("\n"),
    "",
    "Return one result per criterion, preserving the exact criterion text.",
  ].join("\n");

  const evaluation = await ctx.aiService.generateStructuredResponse({
    prompt,
    schema: EvaluationSchema,
    systemPrompt: "You are an expert evaluator for Tracking.so coach-agent rule adherence.",
    options: { model: ctx.judgeModel, temperature: 0 },
  });

  return evaluation.results.map((result: any, index: number) => ({
    id: `llm_judge:${index + 1}`,
    kind: "judge" as const,
    pass: result.pass,
    detail: `${result.criterion}: ${result.reasoning}`,
  }));
}

function proposalList(
  artifacts: CoachEvalArtifacts,
  proposal: ProposalKind
): unknown[] {
  if (proposal === "planCreation") return artifacts.planCreationProposals;
  if (proposal === "planModification") return artifacts.planModificationProposals;
  return artifacts.activityLogProposals;
}

function sourceValue(
  artifacts: CoachEvalArtifacts,
  source: ArtifactSource
): unknown {
  if (source === "planCreationProposal") return artifacts.planCreationProposals[0];
  if (source === "planModificationProposal") return artifacts.planModificationProposals[0];
  return artifacts.activityLogProposals[0];
}

function getByPath(value: unknown, pathExpression: string): unknown {
  return pathExpression.split(".").reduce((current: any, segment) => {
    if (current === undefined || current === null) return undefined;
    if (/^\d+$/.test(segment)) return current[Number(segment)];
    return current[segment];
  }, value as any);
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
