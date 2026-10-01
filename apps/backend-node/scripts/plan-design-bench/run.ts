/**
 * Benchmark for the plan-design generator, through the real code path (prompts, schemas, validator,
 * retry). Needs AI_GATEWAY_API_KEY in the environment. Nothing here touches a database.
 *
 *   AI_GATEWAY_API_KEY=... node --import tsx scripts/plan-design-bench/run.ts [--model openai/gpt-6-luna] [--out file.json]
 *
 * Cost = tokens × the Gateway's listed price for that model, fetched at run time.
 */
import fs from "node:fs";
import path from "node:path";
import { createGateway } from "ai";
import { designOptions, extendWindow } from "../../src/services/plan-design/service";
import { routeDays } from "../../src/services/plan-design/frequency";
import type { GenerationUsage } from "../../src/services/plan-design/types";
import { cases, extensionCase } from "./cases";

async function main() {
  const arg = (name: string) => process.argv[process.argv.indexOf(`--${name}`) + 1];
  const model = process.argv.includes("--model") ? arg("model") : "openai/gpt-6-luna";
  const out = process.argv.includes("--out") ? arg("out") : path.join(__dirname, `results-${model.replace("/", "_")}.json`);
  process.env.PLAN_DESIGN_MODEL = model;
  if (!process.env.AI_GATEWAY_API_KEY) throw new Error("Set AI_GATEWAY_API_KEY (never commit it)");

  const { gatewayGenerator } = await import("../../src/services/plan-design/generator");
  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
  const listing = (await gateway.getAvailableModels()).models.find((m) => m.id === model);
  const price = {
    input: Number(listing?.pricing?.input ?? NaN),
    output: Number(listing?.pricing?.output ?? NaN),
    cachedInput: Number(listing?.pricing?.cachedInputTokens ?? NaN),
  };
  const dollars = (u: GenerationUsage[]) => u.reduce((n, x) => n + x.inputTokens * price.input + x.outputTokens * price.output, 0);

  const results: any = { model, startedAt: new Date().toISOString(), pricePerMillion: { input: price.input * 1e6, output: price.output * 1e6 }, cases: [] as any[] };
  const save = () => fs.writeFileSync(out, JSON.stringify(results, null, 2));

  for (const c of cases) {
    const started = Date.now();
    const record: any = { id: c.id, title: c.title, source: c.source, input: c.input, status: "running" };
    results.cases.push(record);
    try {
      const result = await designOptions(c.input, gatewayGenerator);
      const text = JSON.stringify(result.options);
      const paces = result.options.flatMap((o) => o.sessions.map((s) => s.targets.pace?.basis).filter(Boolean));
      record.status = result.status;
      record.question = result.question;
      record.baselineMeasurements = result.baseline.measurements;
      record.options = result.options;
      record.attempts = result.usage.length;
      record.usage = result.usage;
      record.costUsd = dollars(result.usage);
      record.seconds = Math.round((Date.now() - started) / 100) / 10;
      record.checks = {
        days: result.options.map((o) => o.trainingDaysPerWeek).join("/") === `${routeDays(c.input.availableDays).steady}/${routeDays(c.input.availableDays).focused}`,
        paceBasis: c.expect.paceBasis ? paces.length > 0 && paces.every((p) => p === c.expect.paceBasis) : null,
        targetKept: c.expect.targetPreserved ? text.includes(c.expect.targetPreserved) || /./.test(c.input.goalSpec.text ?? "") : null,
        noInvented: c.expect.noInvented ? !c.expect.noInvented.test(text) : null,
        lifting: c.expect.lifting ? result.options.every((o) => o.sessions.every((s) => s.targets.sets && s.targets.reps && s.targets.loadKg)) : null,
        routesDiffer: result.options.length === 2 && result.options[0].estimatedWeeks !== result.options[1].estimatedWeeks,
      };
    } catch (e: any) {
      record.status = "error";
      record.error = String(e?.message ?? e).slice(0, 300);
    }
    save();
    console.log(c.id, record.status, record.costUsd?.toFixed(5), record.checks);
  }

  // Rolling regeneration from the first case's chosen route.
  const first = results.cases.find((c: any) => c.id === "half-marathon" && c.options);
  if (first) {
    const sessions = first.options[0].sessions.map((s: any, i: number) => ({
      id: `s${i}`, date: s.date, activityId: "running", quantity: s.quantity, title: s.title, targets: s.targets, completed: i < 3,
    }));
    const started = Date.now();
    const record: any = { id: "extend-after-hard-run", title: "Next two weeks after a hard long run", status: "running" };
    results.cases.push(record);
    try {
      const window = await extendWindow(extensionCase({ sessions }), gatewayGenerator);
      record.status = "READY";
      record.window = window;
      record.usage = [window.usage];
      record.costUsd = dollars([window.usage]);
      record.seconds = Math.round((Date.now() - started) / 100) / 10;
    } catch (e: any) {
      record.status = "error";
      record.error = String(e?.message ?? e).slice(0, 300);
    }
    save();
    console.log(record.id, record.status, record.costUsd?.toFixed(5));
  }
  results.finishedAt = new Date().toISOString();
  results.totalCostUsd = results.cases.reduce((n: number, c: any) => n + (c.costUsd ?? 0), 0);
  save();
  console.log("saved", out, "total $", results.totalCostUsd.toFixed(4));

}
main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
