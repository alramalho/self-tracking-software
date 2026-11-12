/**
 * Voice-log extraction benchmark: transcript + catalog → activities, quantities, dates, metrics, through the real
 * extraction code (src/services/voice-log/extract.ts). Text only, no audio. Needs AI_GATEWAY_API_KEY, so run it
 * inside the backend container (the local gateway key doesn't work):
 *
 *   docker cp scripts/voice-log-bench tsw-backend:/app/apps/backend-node/scripts/
 *   docker exec tsw-backend node --import tsx scripts/voice-log-bench/run.ts --config v3:openai/gpt-6-luna:medium
 *
 * --config prompt:model:effort (repeatable; see PROMPTS below).
 * Results are cached per config and case in scripts/voice-log-bench/runs/, so re-runs only pay for new cases.
 * Cost is the Gateway's own reported cost per call.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { extractVoiceLog, VOICE_LOG_PROMPT } from "../../src/services/voice-log/extract";
import type { VoiceLogExtraction } from "../../src/services/voice-log/types";
import { cases, NOW, ownerActivities, ownerMetrics, TIMEZONE, TODAY, type BenchCase } from "./cases";
import { PROMPT_V1 } from "./prompt-v1";

// v1 = the prompt before 12 Nov 2026. v3 = the current prompt with decimal quantities rounded in code.
// (v2 was an intermediate version with whole-number quantities; its runs are kept in runs/ for the record.)
const PROMPTS: Record<string, string> = { v1: PROMPT_V1, v3: VOICE_LOG_PROMPT };

export function score(c: BenchCase, x: VoiceLogExtraction) {
  const problems: string[] = [];
  const remaining = [...x.activities];
  for (const e of c.expect.activities) {
    const ids = [e.id].flat();
    const i = remaining.findIndex((a) => ids.includes(a.activityId));
    if (i < 0) {
      problems.push(`missing ${ids[0]}`);
      continue;
    }
    const got = remaining.splice(i, 1)[0];
    if (![e.quantity].flat().includes(got.quantity)) problems.push(`${ids[0]} quantity ${got.quantity} ≠ ${e.quantity}`);
    if (got.date !== (e.date ?? TODAY)) problems.push(`${ids[0]} date ${got.date} ≠ ${e.date ?? TODAY}`);
  }
  for (const extra of remaining) problems.push(`extra ${extra.activityId} ${extra.quantity}`);
  const expectedMetrics = c.expect.metrics ?? [];
  for (const m of expectedMetrics) {
    const got = x.metrics.find((g) => g.metricId === m.id);
    if (!got) problems.push(`missing metric ${m.id}`);
    else if (![m.rating].flat().includes(got.rating)) problems.push(`metric ${m.id} ${got.rating} ≠ ${m.rating}`);
  }
  for (const extra of x.metrics.filter((g) => !expectedMetrics.some((m) => m.id === g.metricId))) {
    problems.push(`extra metric ${extra.metricId}`);
  }
  if (c.expect.unresolvedMentions && !x.unresolved.some((u) => c.expect.unresolvedMentions!.test(`${u.text} ${u.reason}`))) {
    problems.push("not flagged in unresolved");
  }
  const d = c.expect.descriptionMentions;
  if (d) {
    const got = x.activities.find((g) => g.activityId === d.id);
    if (got && !d.pattern.test(got.description ?? "")) problems.push(`${d.id} description lost details: ${JSON.stringify(got.description ?? null)}`);
  }
  return problems;
}

const hash = (c: BenchCase) => crypto.createHash("sha1").update(JSON.stringify([c.transcript, c.activities ?? null, c.metrics ?? null])).digest("hex").slice(0, 10);

async function runConfig(config: string, only: string[] | null) {
  const [promptName, model, effort = "low"] = config.split(":");
  const instructions = PROMPTS[promptName];
  if (!instructions) throw new Error(`Unknown prompt ${promptName}`);
  const file = path.join(__dirname, "runs", `${config.replace(/[/:]/g, "_")}.json`);
  const cache: Record<string, any> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const selected = cases.filter((c) => !only || only.includes(c.id));
  // A few at a time: fast enough, and polite to the gateway.
  const queue = [...selected];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const key = `${c.id}@${hash(c)}`;
        if (cache[key]?.extraction) continue;
        try {
          const r = await extractVoiceLog({
            transcript: c.transcript,
            now: NOW,
            timezone: TIMEZONE,
            activities: c.activities ?? ownerActivities,
            metrics: c.metrics ?? ownerMetrics,
            model,
            reasoningEffort: effort,
            instructions,
          });
          cache[key] = { extraction: r.extraction, costUsd: r.costUsd, ms: r.durationMs };
        } catch (e: any) {
          cache[key] = { error: String(e?.message ?? e).slice(0, 300) };
        }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(cache, null, 2));
      }
    }),
  );

  let passed = 0;
  let cost = 0;
  const ms: number[] = [];
  const failures: string[] = [];
  for (const c of selected) {
    const r = cache[`${c.id}@${hash(c)}`];
    cost += r?.costUsd ?? 0;
    if (r?.ms) ms.push(r.ms);
    const problems = r?.extraction ? score(c, r.extraction) : [`error: ${r?.error}`];
    if (problems.length === 0) passed++;
    else failures.push(`  ${c.id}: ${problems.join("; ")}`);
  }
  ms.sort((p, q) => p - q);
  const median = ms[Math.floor(ms.length / 2)] ?? 0;
  console.log(`${config}: ${passed}/${selected.length} passed, $${cost.toFixed(4)} total, median ${(median / 1000).toFixed(1)}s`);
  for (const f of failures) console.log(f);
  return { config, passed, total: selected.length, costUsd: cost, medianMs: median };
}

async function main() {
  const configs: string[] = [];
  process.argv.forEach((v, i) => process.argv[i - 1] === "--config" && configs.push(v));
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(",") : null;
  if (!process.env.AI_GATEWAY_API_KEY) throw new Error("Set AI_GATEWAY_API_KEY (run inside tsw-backend)");
  process.env.VOICE_LOG_SAMPLES = "off";
  const summary = [];
  for (const config of configs.length ? configs : ["v3:openai/gpt-6-luna:medium"]) summary.push(await runConfig(config, only));
  console.log(JSON.stringify(summary));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
