#!/usr/bin/env tsx

import dotenv from "dotenv";
import path from "path";
import { runCoachEvals } from "./runner";
import { tests } from "./tests";

const SUITE_NAME = "coach-agent-rule-adherence-v1";

const MODELS_TO_TEST = [
  "google/gemini-3-flash-preview",
  "moonshotai/kimi-k2.6",
];

type CliArgs = {
  models: string[];
  caseIds: string[];
  runs: number;
  out?: string;
  prod: boolean;
  skipJudge: boolean;
  fetchPrices: boolean;
  judgeModel: string;
  concurrency: number;
  list: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    models: [],
    caseIds: [],
    runs: 1,
    prod: false,
    skipJudge: false,
    fetchPrices: true,
    judgeModel: process.env.COACH_BENCHMARK_JUDGE_MODEL || "openai/gpt-5.4-mini",
    concurrency: Number.parseInt(process.env.COACH_BENCHMARK_CONCURRENCY || "4", 10) || 4,
    list: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--list") {
      args.list = true;
    } else if (arg === "--model" && argv[i + 1]) {
      args.models.push(argv[++i]);
    } else if (arg === "--models" && argv[i + 1]) {
      args.models.push(
        ...argv[++i]
          .split(",")
          .map((model) => model.trim())
          .filter(Boolean)
      );
    } else if (arg === "--case" && argv[i + 1]) {
      args.caseIds.push(argv[++i]);
    } else if (arg === "--runs" && argv[i + 1]) {
      const runs = Number.parseInt(argv[++i], 10);
      args.runs = Number.isFinite(runs) && runs > 0 ? runs : 1;
    } else if (arg === "--out" && argv[i + 1]) {
      args.out = path.resolve(argv[++i]);
    } else if (arg === "--prod") {
      args.prod = true;
    } else if (arg === "--skip-judge") {
      args.skipJudge = true;
    } else if (arg === "--judge-model" && argv[i + 1]) {
      args.judgeModel = argv[++i];
    } else if (arg === "--concurrency" && argv[i + 1]) {
      const concurrency = Number.parseInt(argv[++i], 10);
      args.concurrency = Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 4;
    } else if (arg === "--no-prices") {
      args.fetchPrices = false;
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  const envModels = (process.env.COACH_BENCHMARK_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  if (args.models.length === 0) {
    args.models = envModels.length > 0 ? envModels : MODELS_TO_TEST;
  }

  return args;
}

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  pnpm --dir apps/backend-node coach:benchmark",
      "  pnpm --dir apps/backend-node coach:benchmark --case inline_curriculum_specific_plan --model google/gemini-3-flash-preview --skip-judge",
      "",
      "Options:",
      "  --models <a,b>       Comma-separated model IDs.",
      "  --model <id>         Add one model ID. Can be repeated.",
      "  --case <id>          Run only one case. Can be repeated.",
      "  --runs <n>           Runs per test/model. Default: 1.",
      "  --concurrency <n>    Parallel jobs. Default: 4.",
      "  --skip-judge         Run deterministic checks only.",
      "  --judge-model <id>   LLM-as-judge model. Default: openai/gpt-5.4-mini.",
      "  --prod               Use PROD_DATABASE_URL/.env.prod. Only benchmark user IDs are touched.",
      "  --no-prices          Do not fetch model prices.",
      "  --list               List selected tests and exit.",
      "  --out <path>         Output JSON path.",
    ].join("\n")
  );
}

function loadEnv(prod: boolean): void {
  const backendRoot = path.resolve(__dirname, "../../..");
  dotenv.config({ path: path.join(backendRoot, ".env") });
  if (prod) {
    dotenv.config({ path: path.join(backendRoot, ".env.prod"), override: true });
  }
}

function getDatabaseUrl(prod: boolean): string {
  const databaseUrl = prod
    ? process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
    : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(prod ? "PROD_DATABASE_URL is not set" : "DEV_DATABASE_URL is not set");
  }

  return databaseUrl;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const selectedTests = tests.filter((test) =>
    args.caseIds.length > 0 ? args.caseIds.includes(test.id) : true
  );

  if (args.list) {
    for (const test of selectedTests) {
      const marker = test.only ? " only" : test.skip ? ` skip:${test.skip}` : "";
      console.log(`${test.id}${marker} - ${test.name}`);
    }
    return;
  }

  loadEnv(args.prod);
  process.env.DATABASE_URL = getDatabaseUrl(args.prod);

  const { outputPath, summary } = await runCoachEvals({
    suiteName: SUITE_NAME,
    tests,
    models: args.models,
    caseIds: args.caseIds,
    runs: args.runs,
    out: args.out,
    prod: args.prod,
    skipJudge: args.skipJudge,
    fetchPrices: args.fetchPrices,
    judgeModel: args.judgeModel,
    concurrency: args.concurrency,
  });

  console.log("\nSummary:");
  for (const row of summary) {
    const cost = typeof row.totalCostUsd === "number" ? `, cost $${row.totalCostUsd.toFixed(6)}` : "";
    console.log(
      `- ${row.model}: pass ${(row.passRate * 100).toFixed(1)}%, avg ${row.avgLatencyMs.toFixed(0)}ms${cost}`
    );
  }
  console.log(`\nWrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
