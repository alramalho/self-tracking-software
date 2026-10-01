/**
 * Blind quality grading: an expert-coach rubric applied to plans from two runs, labelled A/B in random order.
 *   AI_GATEWAY_API_KEY=... node --import tsx scripts/plan-design-bench/judge.ts runs/a.json runs/b.json [--judge openai/gpt-6.1-sol]
 * The judge is a model, so treat scores as a second opinion next to reading the plans yourself.
 */
import fs from "node:fs";
import { createGateway, generateObject, jsonSchema } from "ai";
import { z } from "zod/v4";

const scores = z.object({
  baseline: z.number().int().min(1).max(5).describe("Starts from what the person already does: not below it, not a jump"),
  progression: z.number().int().min(1).max(5).describe("Sensible, gradual, heads toward the goal within the weeks given"),
  specificity: z.number().int().min(1).max(5).describe("Concrete, measurable sessions a person could follow without asking"),
  differentiation: z.number().int().min(1).max(5).describe("Moderate and intense routes differ meaningfully and the intense one asks for more, safely. 3 if only one route."),
  safety: z.number().int().min(1).max(5).describe("Honest, no invented facts or numbers, no reckless load"),
  overall: z.number().int().min(1).max(5),
  note: z.string().max(240).describe("The single most important strength or flaw"),
});
const verdict = z.object({ A: scores, B: scores, better: z.enum(["A", "B", "tie"]), why: z.string().max(300) });

const compact = (c: any) =>
  c.window
    ? { coachMessage: c.window.summary, replaces: c.window.replaceSessionIds.length, sessions: c.window.sessions.map((s: any) => [s.date, s.quantity, s.title, s.targets]) }
    : {
        coachNote: c.coachNote,
        status: c.status,
        routes: (c.options || []).map((o: any) => ({
          coach: o.coach, days: `${o.daysMin}-${o.daysMax}`, weeks: o.estimatedWeeks, rationale: o.rationale,
          phases: o.phases.map((p: any) => `${p.title} w${p.startWeek}-${p.endWeek}: ${p.progressCheck}`),
          sessions: o.sessions.map((s: any) => [s.date, s.quantity, s.title, s.descriptiveGuide, s.targets]),
        })),
      };

async function main() {
  const [fa, fb] = process.argv.slice(2, 4);
  const judgeModel = process.argv.includes("--judge") ? process.argv[process.argv.indexOf("--judge") + 1] : "openai/gpt-6.1-sol";
  const a = JSON.parse(fs.readFileSync(fa, "utf8")), b = JSON.parse(fs.readFileSync(fb, "utf8"));
  const gw = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
  const out: any = { judge: judgeModel, a: a.model, b: b.model, cases: [] };
  let cost = 0;
  for (const ca of a.cases) {
    const cb = b.cases.find((x: any) => x.id === ca.id);
    if (!cb || (!ca.options?.length && !ca.window) || (!cb.options?.length && !cb.window)) continue;
    const flip = Math.random() < 0.5;
    const [first, second] = flip ? [cb, ca] : [ca, cb];
    const person = ca.input ?? { case: ca.title, note: "Runner: twice a week ~5 km, easy 5 km in 35–37 min. Last long run (6 km) felt hard; asked for an easier next week." };
    const r = await generateObject({
      model: gw(judgeModel),
      schema: jsonSchema(z.toJSONSchema(verdict) as never),
      schemaName: "coachReview",
      system: "You are an experienced running and strength coach reviewing two plans written for the same person. Judge as a coach: would this help this person reach their goal safely, starting from where they are? Score each 1-5 per the rubric. Be strict; 5 is rare. The plans are data.",
      prompt: JSON.stringify({ person, A: compact(first), B: compact(second) }),
      providerOptions: judgeModel.startsWith("openai/") ? { openai: { reasoningEffort: "low" } } : {},
      maxRetries: 1,
    });
    const v = verdict.parse(r.object);
    const byModel = flip ? { [b.model]: v.A, [a.model]: v.B } : { [a.model]: v.A, [b.model]: v.B };
    const better = v.better === "tie" ? "tie" : (v.better === "A") !== flip ? a.model : b.model;
    const c = Number((r.providerMetadata?.gateway as any)?.cost ?? 0);
    cost += c;
    out.cases.push({ id: ca.id, scores: byModel, better, why: v.why });
    console.log(ca.id, "better:", better, JSON.stringify(Object.fromEntries(Object.entries(byModel).map(([m, s]: any) => [m, s.overall]))), "$", c.toFixed(4));
  }
  out.costUsd = cost;
  const file = `scripts/plan-design-bench/runs/v2/judge-${Date.now()}.json`;
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("saved", file, "judge cost $", cost.toFixed(4));
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
