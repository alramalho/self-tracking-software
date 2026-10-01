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
import type { GenerationUsage } from "../../src/services/plan-design/types";
import { adaptCases, cases } from "./cases";

async function main() {
  const arg = (name: string) => process.argv[process.argv.indexOf(`--${name}`) + 1];
  const model = process.argv.includes("--model") ? arg("model") : "openai/gpt-6-luna";
  const out = process.argv.includes("--out") ? arg("out") : path.join(__dirname, `results-${model.replace("/", "_")}.json`);
  // The model under test designs the routes and adapts the plan. The short calls (goal read, days check)
  // stay on the default quick model so every run shares them, and the fallback is off for a fair comparison.
  process.env.PLAN_DESIGN_MODEL = model;
  process.env.PLAN_ADAPT_MODEL = model;
  process.env.PLAN_FALLBACK_MODEL = "none";
  if (!process.env.AI_GATEWAY_API_KEY) throw new Error("Set AI_GATEWAY_API_KEY (never commit it)");

  const { gatewayGenerator } = await import("../../src/services/plan-design/generator");
  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
  const listed = (await gateway.getAvailableModels()).models;
  const priceOf = (id: string) => {
    const m = listed.find((x) => x.id === id);
    return { input: Number(m?.pricing?.input ?? NaN), output: Number(m?.pricing?.output ?? NaN) };
  };
  const price = priceOf(model);
  // Each call is priced at its own model's listed rate (the short calls run on a different model).
  const dollars = (u: GenerationUsage[]) => u.reduce((n, x) => n + x.inputTokens * priceOf(x.model).input + x.outputTokens * priceOf(x.model).output, 0);

  const results: any = { model, startedAt: new Date().toISOString(), pricePerMillion: { input: price.input * 1e6, output: price.output * 1e6 }, cases: [] as any[] };
  const save = () => fs.writeFileSync(out, JSON.stringify(results, null, 2));

  const only = process.argv.includes("--only") ? arg("only").split(",") : null;
  for (const c of cases.filter((x) => !only || only.includes(x.id))) {
    const started = Date.now();
    const record: any = { id: c.id, title: c.title, source: c.source, input: c.input, status: "running" };
    results.cases.push(record);
    try {
      const result = await designOptions(c.input, gatewayGenerator);
      const text = JSON.stringify(result.options);
      const paces = result.options.flatMap((o) => o.sessions.map((s) => s.targets.pace?.basis).filter(Boolean));
      record.status = result.status;
      record.coachNote = result.coachNote;
      record.question = result.question;
      record.baselineMeasurements = result.baseline.measurements;
      record.options = result.options;
      record.attempts = result.usage.length;
      record.retried = result.retried;
      record.models = result.models;
      record.usage = result.usage;
      record.costUsd = dollars(result.usage);
      record.seconds = Math.round((Date.now() - started) / 100) / 10;
      record.checks = {
        verdict: [c.expect.verdict ?? "FITS"].flat().includes(result.coachNote?.verdict ?? "FITS"),
          rangesBracketPreference: result.status !== "READY" || (result.coachNote?.verdict !== "FITS") || (result.options[0].daysMax === c.input.preferredDays && result.options[1].daysMin === c.input.preferredDays),
        paceBasis: c.expect.paceBasis ? paces.length > 0 && paces.every((p) => p === c.expect.paceBasis) : null,
        targetKept: c.expect.targetPreserved ? text.includes(c.expect.targetPreserved) || /./.test(c.input.goalSpec.text ?? "") : null,
        noInvented: c.expect.noInvented ? !c.expect.noInvented.test(text) : null,
        lifting: c.expect.lifting ? result.options.every((o) => o.sessions.every((s) => s.targets.sets && s.targets.reps && s.targets.loadKg)) : null,
        routesDiffer: result.options.length === 0 ? null : result.options.length === 2 && result.options[0].estimatedWeeks !== result.options[1].estimatedWeeks,
      };
    } catch (e: any) {
      record.status = "error";
      record.error = String(e?.message ?? e).slice(0, 300);
    }
    save();
    console.log(c.id, record.status, record.costUsd?.toFixed(5), record.checks);
  }

  // Plan adaptation: the same fixed plan and three situations for every model.
  for (const c of adaptCases.filter((x) => !only || only.includes(x.id) || only.includes("adapt"))) {
    const started = Date.now();
    const record: any = { id: c.id, title: c.title, expect: c.expect, input: { results: c.input.results, feedback: c.input.feedback, today: c.input.today }, status: "running" };
    results.cases.push(record);
    try {
      const window = await extendWindow(c.input, gatewayGenerator);
      record.status = "READY";
      record.window = window;
      record.usage = window.calls ?? [window.usage];
      record.costUsd = dollars(record.usage);
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
