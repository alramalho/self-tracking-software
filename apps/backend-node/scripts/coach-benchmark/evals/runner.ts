import fs from "fs";
import path from "path";
import { createRequire } from "module";
import type {
  CoachEvalArtifacts,
  CoachEvalFixture,
  CoachEvalRunResult,
  CoachEvalSummaryRow,
  CoachEvalTest,
} from "./types";

const requireFromRunner = createRequire(__filename);

type ModelPricing = {
  input?: string;
  output?: string;
  prompt?: string;
  completion?: string;
  request?: string;
  internal_reasoning?: string;
  input_cache_read?: string;
  input_cache_write?: string;
};

export type RunCoachEvalsOptions = {
  suiteName: string;
  tests: CoachEvalTest[];
  models: string[];
  caseIds?: string[];
  runs?: number;
  out?: string;
  prod?: boolean;
  skipJudge?: boolean;
  fetchPrices?: boolean;
  judgeModel: string;
  concurrency?: number;
};

type EvalJob = {
  test: CoachEvalTest;
  model: string;
  run: number;
};

export async function runCoachEvals(options: RunCoachEvalsOptions): Promise<{
  outputPath: string;
  summary: CoachEvalSummaryRow[];
  results: CoachEvalRunResult[];
}> {
  const selectedTests = selectTests(options.tests, options.caseIds || []);
  if (selectedTests.length === 0) {
    throw new Error("No eval tests selected");
  }

  const { prisma } = requireFromRunner("../../../src/utils/prisma") as typeof import("../../../src/utils/prisma");
  const { coachAgentService } = requireFromRunner(
    "../../../src/services/coach/agent"
  ) as typeof import("../../../src/services/coach/agent");
  const { requestContext } = requireFromRunner(
    "../../../src/utils/requestContext"
  ) as typeof import("../../../src/utils/requestContext");
  const { aiService } = requireFromRunner("../../../src/services/aiService") as typeof import("../../../src/services/aiService");

  let pricingByModel = new Map<string, ModelPricing>();
  if (options.fetchPrices !== false) {
    try {
      pricingByModel = await fetchModelPricing(options.models);
    } catch (error) {
      console.warn(
        `Could not fetch model pricing, costUsd will be omitted: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  const jobs = createJobs({
    tests: selectedTests,
    models: options.models,
    runs: options.runs || 1,
  });

  const results = await runPool(
    jobs,
    Math.max(1, options.concurrency || 4),
    async (job) => {
      const result = await runOne({
        suiteName: options.suiteName,
        test: job.test,
        model: job.model,
        run: job.run,
        prisma,
        coachAgentService,
        requestContext,
        aiService,
        judgeModel: options.judgeModel,
        skipJudge: !!options.skipJudge,
        pricing: pricingByModel.get(job.model),
      });
      console.log(
        `[${job.model}] ${job.test.id} run ${job.run}/${options.runs || 1} ${result.pass ? "pass" : "fail"}`
      );
      return result;
    }
  );

  await Promise.all(
    jobs.map((job) =>
      cleanupBenchmarkUser(
        prisma,
        jobFixtureUserId(job.test.fixture, job.model, job.run)
      )
    )
  );
  await prisma.$disconnect();

  const summary = summarize(results);
  const outputPath =
    options.out ||
    path.join(
      __dirname,
      "..",
      "results",
      `${options.suiteName}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
  writeResults({
    outputPath,
    suiteName: options.suiteName,
    options,
    summary,
    results,
  });

  return { outputPath, summary, results };
}

function selectTests(tests: CoachEvalTest[], caseIds: string[]): CoachEvalTest[] {
  const selectedById = caseIds.length
    ? tests.filter((test) => caseIds.includes(test.id))
    : tests;
  const onlyTests = selectedById.filter((test) => test.only);
  const selected = onlyTests.length > 0 ? onlyTests : selectedById;

  return selected.filter((test) => !test.skip);
}

function createJobs(params: {
  tests: CoachEvalTest[];
  models: string[];
  runs: number;
}): EvalJob[] {
  return params.models.flatMap((model) =>
    params.tests.flatMap((test) =>
      Array.from({ length: params.runs }, (_, index) => ({
        test,
        model,
        run: index + 1,
      }))
    )
  );
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex++;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    })
  );

  return results;
}

async function runOne(params: {
  suiteName: string;
  test: CoachEvalTest;
  model: string;
  run: number;
  prisma: any;
  coachAgentService: any;
  requestContext: any;
  aiService: any;
  judgeModel: string;
  skipJudge: boolean;
  pricing?: ModelPricing;
}): Promise<CoachEvalRunResult> {
  try {
    const fixture = createJobFixture(params.test.fixture, params.model, params.run);
    const user = await seedFixture(params.prisma, fixture);
    const { plans, reminders } = await loadRuntimeContext(params.prisma, user.id);

    const startedAt = process.hrtime.bigint();
    const response = await params.requestContext.run({ user }, () =>
      params.coachAgentService.generateResponse({
        user,
        message: params.test.userMessage,
        conversationHistory: fixture.conversationHistory || [],
        plans,
        reminders,
        memoriesContext: fixture.memoriesContext || null,
        model: params.model,
      })
    );
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    const responseText = (response.draftMessages || [])
      .map((draft: any) => draft.content)
      .join("\n");
    const artifacts = extractArtifacts(response);
    const verifyResults = await params.test.verify({
      testId: params.test.id,
      testName: params.test.name,
      userMessage: params.test.userMessage,
      responseText,
      artifacts,
      skipJudge: params.skipJudge,
      judgeModel: params.judgeModel,
      aiService: params.aiService,
    });
    const activeResults = verifyResults.filter((result) => !result.skipped);
    const deterministicResults = verifyResults.filter(
      (result) => result.kind === "deterministic"
    );
    const judgeResults = verifyResults.filter(
      (result) => result.kind === "judge" && !result.skipped
    );
    const deterministicPass = deterministicResults.every((result) => result.pass);
    const judgePass =
      judgeResults.length > 0 ? judgeResults.every((result) => result.pass) : undefined;
    const usage = response.telemetry?.usage;
    const stepCount = response.telemetry?.stepCount;

    return {
      testId: params.test.id,
      testName: params.test.name,
      model: params.model,
      run: params.run,
      latencyMs,
      costUsd: estimateCostUsd({ usage, stepCount, pricing: params.pricing }),
      usage,
      stepCount,
      pass: activeResults.every((result) => result.pass),
      deterministicPass,
      judgePass,
      verifyResults,
      responseText,
      artifacts,
    };
  } catch (error) {
    return {
      testId: params.test.id,
      testName: params.test.name,
      model: params.model,
      run: params.run,
      latencyMs: 0,
      pass: false,
      deterministicPass: false,
      verifyResults: [],
      responseText: "",
      artifacts: {
        toolCalls: [],
        planCreationProposals: [],
        planModificationProposals: [],
        activityLogProposals: [],
        activityEditProposals: [],
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function createJobFixture(
  fixture: CoachEvalFixture,
  model: string,
  run: number
): CoachEvalFixture {
  const suffix = `${model.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${run}`;
  const cloned = JSON.parse(JSON.stringify(fixture));
  const idMap = new Map<string, string>();

  collectId(idMap, cloned.user, suffix);
  cloned.user.email = `${cloned.user.id}@example.com`;

  for (const plan of cloned.plans || []) {
    collectId(idMap, plan, suffix);
    for (const activity of plan.activities || []) collectId(idMap, activity, suffix);
    for (const session of plan.sessions || []) collectId(idMap, session, suffix);
    for (const milestone of plan.milestones || []) collectId(idMap, milestone, suffix);
  }
  for (const reminder of cloned.reminders || []) collectId(idMap, reminder, suffix);

  for (const plan of cloned.plans || []) {
    for (const session of plan.sessions || []) {
      if (session.activityId && idMap.has(session.activityId)) {
        session.activityId = idMap.get(session.activityId);
      }
    }
  }
  for (const entry of cloned.activityEntries || []) {
    if (entry.activityId && idMap.has(entry.activityId)) {
      entry.activityId = idMap.get(entry.activityId);
    }
  }

  return cloned;
}

function collectId(idMap: Map<string, string>, value: any, suffix: string): void {
  if (!value?.id) return;
  const original = value.id;
  const next = `${original}-${suffix}`;
  idMap.set(original, next);
  value.id = next;
}

function jobFixtureUserId(
  fixture: CoachEvalFixture,
  model: string,
  run: number
): string {
  const suffix = `${model.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${run}`;
  return `${fixture.user.id}-${suffix}`;
}

function extractArtifacts(response: any): CoachEvalArtifacts {
  const drafts = response.draftMessages || [];
  return {
    toolCalls: drafts.flatMap((draft: any) => draft.toolCalls || []),
    planCreationProposals: drafts.flatMap((draft: any) => draft.planCreationProposals || []),
    planModificationProposals: drafts.flatMap((draft: any) => draft.planProposals || []),
    activityLogProposals: drafts.flatMap((draft: any) => draft.activityLogProposals || []),
    activityEditProposals: drafts.flatMap((draft: any) => draft.activityEditProposals || []),
  };
}

async function fetchModelPricing(models: string[]): Promise<Map<string, ModelPricing>> {
  const gatewayResponse = await fetch("https://ai-gateway.vercel.sh/v1/models");
  if (gatewayResponse.ok) {
    const body = await gatewayResponse.json();
    const modelData = Array.isArray(body.data) ? body.data : [];
    const prices = new Map<string, ModelPricing>();
    for (const model of models) {
      const match =
        modelData.find((item: any) => item.id === model) ||
        modelData.find((item: any) => item.id === model.replace(/-preview$/, ""));
      if (match?.pricing) prices.set(model, match.pricing);
    }
    if (prices.size > 0) return prices;
  }

  const headers: Record<string, string> = {};
  if (process.env.OPENROUTER_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  const response = await fetch("https://openrouter.ai/api/v1/models", { headers });
  if (!response.ok) {
    throw new Error(`Model pricing APIs returned ${gatewayResponse.status} and ${response.status}`);
  }

  const body = await response.json();
  const modelData = Array.isArray(body.data) ? body.data : [];
  const prices = new Map<string, ModelPricing>();
  for (const model of models) {
    const match = modelData.find((item: any) => item.id === model);
    if (match?.pricing) prices.set(model, match.pricing);
  }

  return prices;
}

function priceNumber(value?: string): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimateCostUsd(params: {
  usage?: any;
  stepCount?: number;
  pricing?: ModelPricing;
}): number | undefined {
  const { usage, pricing } = params;
  if (!usage || !pricing) return undefined;

  const cacheReadTokens = Number(usage.cacheReadTokens || 0);
  const cacheWriteTokens = Number(usage.cacheWriteTokens || 0);
  const inputTokens = Number(usage.inputTokens || 0);
  const outputTokens = Number(usage.outputTokens || 0);
  const reasoningTokens = Number(usage.reasoningTokens || 0);
  const uncachedInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens);

  return (
    uncachedInputTokens * priceNumber(pricing.input || pricing.prompt) +
    outputTokens * priceNumber(pricing.output || pricing.completion) +
    cacheReadTokens * priceNumber(pricing.input_cache_read) +
    cacheWriteTokens * priceNumber(pricing.input_cache_write) +
    reasoningTokens * priceNumber(pricing.internal_reasoning) +
    (params.stepCount || 1) * priceNumber(pricing.request)
  );
}

async function cleanupBenchmarkUser(prisma: any, userId: string): Promise<void> {
  const [activities, plans] = await Promise.all([
    prisma.activity.findMany({ where: { userId }, select: { id: true } }),
    prisma.plan.findMany({ where: { userId }, select: { id: true } }),
  ]);
  const activityIds = activities.map((activity: any) => activity.id);
  const planIds = plans.map((plan: any) => plan.id);

  await prisma.activityEntry.deleteMany({ where: { userId } });
  await prisma.reminder.deleteMany({ where: { userId } });

  const sessionDeleteOr = [];
  if (planIds.length > 0) sessionDeleteOr.push({ planId: { in: planIds } });
  if (activityIds.length > 0) sessionDeleteOr.push({ activityId: { in: activityIds } });
  if (sessionDeleteOr.length > 0) {
    await prisma.planSession.deleteMany({ where: { OR: sessionDeleteOr } });
  }

  if (planIds.length > 0) {
    await prisma.planMilestone.deleteMany({ where: { planId: { in: planIds } } });
  }
  await prisma.activity.deleteMany({ where: { userId } });
  await prisma.plan.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

async function seedFixture(prisma: any, fixture: CoachEvalFixture): Promise<any> {
  const userInput = fixture.user;
  await cleanupBenchmarkUser(prisma, userInput.id);

  const user = await prisma.user.create({
    data: {
      id: userInput.id,
      email: userInput.email,
      username: userInput.username ? `${userInput.username}-${userInput.id}` : null,
      name: userInput.name,
      timezone: userInput.timezone || "Europe/Sofia",
      language: userInput.language || "English",
      planType: userInput.planType || "PLUS",
      coachPersonality: userInput.coachPersonality || "CHAMPION",
    },
  });

  for (const planInput of fixture.plans || []) {
    await prisma.plan.create({
      data: {
        id: planInput.id,
        userId: user.id,
        goal: planInput.goal,
        goalReason: planInput.goalReason || null,
        emoji: planInput.emoji || "🎯",
        outlineType: planInput.outlineType || "SPECIFIC",
        timesPerWeek: planInput.timesPerWeek || null,
        notes: planInput.notes || null,
        finishingDate: planInput.finishingDate ? new Date(planInput.finishingDate) : null,
      },
    });

    for (const activityInput of planInput.activities || []) {
      await prisma.activity.create({
        data: {
          id: activityInput.id,
          userId: user.id,
          title: activityInput.title,
          measure: activityInput.measure,
          emoji: activityInput.emoji,
          kind: activityInput.kind || "other",
          plans: { connect: { id: planInput.id } },
        },
      });
    }

    for (const sessionInput of planInput.sessions || []) {
      await prisma.planSession.create({
        data: {
          id: sessionInput.id,
          planId: planInput.id,
          activityId: sessionInput.activityId,
          date: new Date(sessionInput.date),
          quantity: sessionInput.quantity || 1,
          descriptiveGuide: sessionInput.descriptiveGuide || "",
        },
      });
    }

    for (const milestoneInput of planInput.milestones || []) {
      await prisma.planMilestone.create({
        data: {
          id: milestoneInput.id,
          planId: planInput.id,
          date: new Date(milestoneInput.date),
          description: milestoneInput.description,
          progress: milestoneInput.progress ?? null,
          criteria: milestoneInput.criteria ?? undefined,
        },
      });
    }
  }

  for (const entryInput of fixture.activityEntries || []) {
    await prisma.activityEntry.create({
      data: {
        userId: user.id,
        activityId: entryInput.activityId,
        datetime: new Date(entryInput.datetime),
        quantity: entryInput.quantity || 1,
        description: entryInput.description || null,
      },
    });
  }

  for (const reminderInput of fixture.reminders || []) {
    await prisma.reminder.create({
      data: {
        id: reminderInput.id,
        userId: user.id,
        message: reminderInput.message,
        triggerAt: new Date(reminderInput.triggerAt),
        isRecurring: reminderInput.isRecurring || false,
        recurringType: reminderInput.recurringType || null,
        recurringDays: reminderInput.recurringDays || [],
        status: reminderInput.status || "PENDING",
      },
    });
  }

  return user;
}

async function loadRuntimeContext(prisma: any, userId: string): Promise<{
  plans: any[];
  reminders: any[];
}> {
  const now = new Date();
  const [plans, reminders] = await Promise.all([
    prisma.plan.findMany({
      where: {
        userId,
        deletedAt: null,
        archivedAt: null,
        isPaused: false,
        OR: [{ finishingDate: null }, { finishingDate: { gt: now } }],
      },
      include: { activities: true, sessions: true, milestones: true },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.reminder.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { triggerAt: "asc" },
    }),
  ]);

  return { plans, reminders };
}

function summarize(results: CoachEvalRunResult[]): CoachEvalSummaryRow[] {
  const byModel = new Map<string, CoachEvalRunResult[]>();
  for (const result of results) {
    byModel.set(result.model, [...(byModel.get(result.model) || []), result]);
  }

  return Array.from(byModel.entries()).map(([model, modelResults]) => {
    const passCount = modelResults.filter((result) => result.pass).length;
    const deterministicPassCount = modelResults.filter((result) => result.deterministicPass).length;
    const judgedResults = modelResults.filter((result) => result.judgePass !== undefined);
    const judgePassCount = judgedResults.filter((result) => result.judgePass).length;
    const costs = modelResults
      .map((result) => result.costUsd)
      .filter((cost): cost is number => typeof cost === "number");

    return {
      model,
      runs: modelResults.length,
      passRate: passCount / modelResults.length,
      deterministicPassRate: deterministicPassCount / modelResults.length,
      judgePassRate: judgedResults.length > 0 ? judgePassCount / judgedResults.length : undefined,
      avgLatencyMs:
        modelResults.reduce((sum, result) => sum + result.latencyMs, 0) / modelResults.length,
      totalCostUsd: costs.length > 0 ? costs.reduce((sum, cost) => sum + cost, 0) : undefined,
    };
  });
}

function writeResults(params: {
  outputPath: string;
  suiteName: string;
  options: RunCoachEvalsOptions;
  summary: CoachEvalSummaryRow[];
  results: CoachEvalRunResult[];
}): void {
  fs.mkdirSync(path.dirname(params.outputPath), { recursive: true });
  fs.writeFileSync(
    params.outputPath,
    JSON.stringify(
      {
        suite: params.suiteName,
        createdAt: new Date().toISOString(),
        args: {
          models: params.options.models,
          caseIds: params.options.caseIds || [],
          runs: params.options.runs || 1,
          prod: !!params.options.prod,
          skipJudge: !!params.options.skipJudge,
          judgeModel: params.options.judgeModel,
          concurrency: params.options.concurrency || 4,
        },
        summary: params.summary,
        results: params.results,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    params.outputPath.replace(/\.json$/, ".jsonl"),
    params.results.map((result) => JSON.stringify(result)).join("\n") + "\n"
  );
}
