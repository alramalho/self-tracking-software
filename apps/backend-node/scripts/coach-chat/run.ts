/**
 * Chat coach benchmark: does the coach's reply help the person who sent it? See README.md.
 *
 * Runs the real coach (prompts, tools, web search) on real messages, with the database swapped for an
 * in-memory copy of each case, so nothing is read from or written to it. Needs the gateway key, so run it
 * inside tsw-backend:
 *
 *   TZ=UTC node --import tsx scripts/coach-chat/run.ts --models openai/gpt-5.6-luna,deepseek/deepseek-v4.1-flash --runs 2
 *   ... --only hsk-deadline,first-walk
 */
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { cases, type Case } from "./cases";

// ---- In-memory database: installed before any app code loads utils/prisma. ----

type Fixture = { userId: string; entries: any[]; sessions: any[] };
const current = new AsyncLocalStorage<Fixture>();
const writes = new AsyncLocalStorage<string[]>();

function inRange(value: Date, where: any) {
  if (!where || typeof where !== "object" || where instanceof Date) return true;
  if (where.gte && value < new Date(where.gte)) return false;
  if (where.gt && value <= new Date(where.gt)) return false;
  if (where.lte && value > new Date(where.lte)) return false;
  if (where.lt && value >= new Date(where.lt)) return false;
  return true;
}

function matchesId(id: string, where: any) {
  if (where === undefined) return true;
  if (typeof where === "string") return id === where;
  if (where?.in) return where.in.includes(id);
  return true;
}

function delegate(model: string) {
  return new Proxy({}, {
    get: (_t, op: string) => {
      if (op === "then") return undefined;
      return async (args: any = {}) => {
        const fx = current.getStore();
        if (/^(create|update|upsert|delete)/.test(op)) {
          writes.getStore()?.push(`${model}.${op}`);
          return args.data ?? args.create ?? { count: 0 };
        }
        if (model === "activityEntry" && fx) {
          const rows = fx.entries
            .filter((e) => inRange(e.datetime, args.where?.datetime) && matchesId(e.activityId, args.where?.activityId))
            .sort((a, b) => b.datetime - a.datetime);
          if (op === "findMany") return rows.slice(0, args.take ?? rows.length);
          if (op === "findFirst") return rows[0] ?? null;
          if (op === "count") return rows.length;
          if (op === "groupBy") {
            const byActivity = new Map<string, any[]>();
            for (const r of rows) byActivity.set(r.activityId, [...(byActivity.get(r.activityId) ?? []), r]);
            return [...byActivity.entries()].map(([activityId, rs]) => ({
              activityId,
              _max: { datetime: rs[0].datetime },
              _count: { _all: rs.length, id: rs.length },
            }));
          }
        }
        if (model === "planSession" && fx && op === "findMany") {
          return fx.sessions.filter((s) => matchesId(s.planId, args.where?.planId) && inRange(s.date, args.where?.date));
        }
        if (op === "findMany" || op === "groupBy") return [];
        if (op === "count") return 0;
        if (op === "aggregate") return { _sum: {}, _count: {}, _max: {}, _min: {} };
        return null;
      };
    },
  });
}

(globalThis as any).__prisma = new Proxy({}, {
  get: (_t, key: string) => {
    if (key === "then") return undefined;
    if (key === "$transaction") return async (x: any) => (typeof x === "function" ? x((globalThis as any).__prisma) : Promise.all(x));
    if (key.startsWith("$")) return () => Promise.resolve([]);
    return delegate(key);
  },
});
process.env.ROUGH_EDGES = "off";
delete process.env.TELEGRAM_BOT_TOKEN;

// ---- Fixtures ----

const DAY = 86_400_000;
const at = (daysFromNow: number, hour = 9) => {
  const d = new Date(Date.now() + daysFromNow * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

function build(c: Case) {
  const userId = `bench-${c.id}`;
  const now = new Date();
  const user = {
    id: userId, name: c.name, username: c.name.toLowerCase(), email: `${userId}@example.invalid`,
    timezone: "Europe/Lisbon", language: "English", planType: "PLUS", coachPersonality: "CHAMPION",
    createdAt: at(-30), proactiveCoachingEnabled: true, aiConsentGrantedAt: at(-30),
  };
  const plans = c.plans.map((p) => {
    const activities = p.activities.map((a, i) => ({
      id: `${p.id}-a${i}`, userId, title: a.title, measure: a.measure, emoji: "•", kind: "other",
      createdAt: at(-30), updatedAt: at(-30), colorHex: null, deletedAt: null,
    }));
    const sessions = (p.sessions ?? []).map((s, i) => ({
      id: `${p.id}-s${i}`, planId: p.id, activityId: activities.find((a) => a.title === s.activity)!.id,
      date: at(s.inDays, 0), quantity: s.quantity, descriptiveGuide: s.guide, isCoachSuggested: false,
      createdAt: at(-7), title: null, targets: null, imageUrls: [],
    }));
    return {
      id: p.id, userId, goal: p.goal, goalReason: p.goalReason ?? null, emoji: null,
      finishingDate: p.finishingDate ? new Date(p.finishingDate) : null, createdAt: at(-30), updatedAt: now,
      deletedAt: null, archivedAt: null, outlineType: p.outlineType, timesPerWeek: p.timesPerWeek ?? null,
      notes: p.notes ?? null, coachNotes: null, internalNotes: null, isPaused: false, progressState: null,
      orientation: null, goalSpec: null, baseline: null, outline: null, confidence: null, designedThrough: null,
      visibility: "PUBLIC", activities, sessions, milestones: [],
    };
  });
  const activityByTitle = new Map(plans.flatMap((p) => p.activities.map((a) => [a.title, a] as const)));
  const entries = (c.entries ?? []).map((e, i) => {
    const a = activityByTitle.get(e.activity)!;
    return {
      id: `${userId}-e${i}`, userId, activityId: a.id, quantity: e.quantity, datetime: at(-e.daysAgo, 8),
      createdAt: at(-e.daysAgo, 8), description: e.note ?? null, privateNotes: null, deletedAt: null,
      difficulty: null, source: "app", activity: { title: a.title, emoji: a.emoji, measure: a.measure },
    };
  });
  return { user, plans, fixture: { userId, entries, sessions: plans.flatMap((p) => p.sessions) } };
}

// ---- Scoring ----

function show(response: any): { text: string; card: string } {
  const drafts: any[] = response?.draftMessages ?? [];
  // The app shows {{plan:id|label}} / {{activity:id|label}} as the label.
  const text = drafts.map((d) => String(d.content ?? "").replace(/\{\{\w+:[^|}]*\|([^}]*)\}\}/g, "$1")).join("\n");
  const cards = drafts.flatMap((d) => [
    ...(d.planProposals ?? []).map((p: any) => `[Plan change card for "${p.planGoal}": ${p.description} | ${JSON.stringify(p.patch).slice(0, 700)}]`),
    ...(d.planCreationProposals ?? []).map((p: any) => `[New plan card: ${p.goal}]`),
    ...(d.activityLogProposals ?? []).map((p: any) => `[Log card: ${JSON.stringify(p).slice(0, 200)}]`),
  ]);
  if (response?.withdrawnPlanChanges?.length) cards.push("[Took back its earlier suggested plan change]");
  return { text, card: cards.join("\n") };
}

/** Rules every chat reply keeps, from what went wrong in production. */
function rules(c: Case, response: any, text: string): string[] {
  const problems: string[] = [];
  const drafts: any[] = response?.draftMessages ?? [];
  if (!drafts.length || drafts.some((d) => d.error)) problems.push("no reply (error)");
  if (/\{\s*"(messages|requiresReply|content)"/.test(text)) problems.push("raw JSON shown to the person");
  // Titles in brackets or quotes ("Are You a Student?") aren't questions to the person.
  const questions = (text.replace(/\([^)]*\)|"[^"]*"|“[^”]*”/g, "").match(/\?/g) ?? []).length;
  if (questions > 1) problems.push(`${questions} questions`);
  const words = text.split(/\s+/).filter(Boolean).length;
  if (!c.long && words > 70) problems.push(`${words} words`);
  return problems;
}

async function judge(aiSdk: any, c: Case, text: string, card: string) {
  const { z } = await import("zod/v4");
  const gateway = aiSdk.createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
  const conversation = [...c.history, { role: "user", content: c.message }]
    .map((t) => `${t.role === "user" ? c.name : "coach"}: ${t.content}`)
    .join("\n");
  const result = await aiSdk.generateObject({
    model: gateway(process.env.COACH_CHAT_JUDGE_MODEL || "anthropic/claude-sonnet-5.5"),
    schemaName: "coach_chat_judge",
    schema: z.object({
      checks: z.array(z.object({ pass: z.boolean(), why: z.string() })),
      glad: z.boolean(),
      why: z.string(),
    }),
    system: `You judge one reply from the coach in a habit-tracking app. People text it like a friend: short, messy, sometimes repeating themselves. A good reply is short, gets what they meant, and moves them forward; a plan change shows up as a card they can accept. Be strict but fair: judge what the person would see, not wording you would prefer.`,
    prompt: `Situation: ${c.situation}\n\nConversation:\n${conversation}\n\nCoach reply:\n${text || "(nothing)"}\n${card ? `\nAttached:\n${card}\n` : ""}\nAnswer each check in order (pass only if the reply clearly does it):\n${c.expect.map((e, i) => `${i + 1}. ${e}`).join("\n")}\n\nThen: would ${c.name} be glad to get this reply? (glad)`,
  });
  return result.object as { checks: { pass: boolean; why: string }[]; glad: boolean; why: string };
}

// ---- Run ----

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function usageCost(file: string, from: number) {
  if (!fs.existsSync(file)) return { coach: 0, judge: 0 };
  const lines = fs.readFileSync(file, "utf8").slice(from).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const sum = (ls: any[]) => ls.reduce((s, l) => s + (l.costUsd || 0), 0);
  return { coach: sum(lines.filter((l) => l.name !== "coach_chat_judge")), judge: sum(lines.filter((l) => l.name === "coach_chat_judge")) };
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: size }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) await fn(item);
  }));
}

async function main() {
  const models = (arg("--models") ?? process.env.COACH_AGENT_MODEL ?? "openai/gpt-5.6-luna").split(",").map((m) => m.trim());
  const runs = Number(arg("--runs") ?? 1);
  const only = arg("--only")?.split(",");
  const selected = cases.filter((c) => !only || only.includes(c.id));
  // Never the app's own usage log: benchmark calls must not show up in analytics.
  const usageFile = path.join("/tmp", `coach-chat-usage-${process.pid}.jsonl`);
  process.env.AI_USAGE_LOG = usageFile;

  const aiSdk = await import("../../src/utils/aiSdk");
  const { coachAgentService } = await import("../../src/services/coach/agent");

  const report: any[] = [];
  const arms: any[] = [];
  for (const model of models) {
    const start = fs.existsSync(usageFile) ? fs.statSync(usageFile).size : 0;
    const jobs = selected.flatMap((c) => Array.from({ length: runs }, (_, run) => ({ c, run })));
    const results: any[] = [];
    await pool(jobs, 4, async ({ c, run }) => {
      const { user, plans, fixture } = build(c);
      const tried: string[] = [];
      const statuses = new Set<string>();
      const t0 = Date.now();
      let response: any = null;
      let crash: string | null = null;
      try {
        response = await current.run(fixture, () => writes.run(tried, () => coachAgentService.generateResponse({
          user: user as any,
          message: c.message,
          conversationHistory: c.history.map((t) => ({ role: t.role, content: t.content })),
          plans: plans as any,
          model,
          memoriesContext: null,
          onStatus: (s: string) => void statuses.add(s),
        })));
      } catch (error) {
        crash = error instanceof Error ? error.message : String(error);
      }
      const seconds = (Date.now() - t0) / 1000;
      const { text, card } = show(response);
      const broken = crash ? [`crashed: ${crash}`] : rules(c, response, text);
      const verdict = text ? await judge(aiSdk, c, text, card).catch((e) => ({ checks: [], glad: false, why: `judge failed: ${e}` })) : { checks: [], glad: false, why: "no reply" };
      const failedChecks = c.expect.filter((_, i) => !verdict.checks[i]?.pass);
      const pass = broken.length === 0 && failedChecks.length === 0 && verdict.glad;
      results.push({ case: c.id, run, model, pass, seconds, searched: statuses.has("searching"), rules: broken, failedChecks, verdict, text, card, wouldWrite: tried });
      console.log(`${pass ? "✓" : "✗"} ${model} ${c.id}#${run} ${seconds.toFixed(0)}s${statuses.has("searching") ? " (searched)" : ""}`);
      for (const b of broken) console.log(`    rule: ${b}`);
      for (const f of failedChecks) console.log(`    missed: ${f}`);
      if (!verdict.glad) console.log(`    not glad: ${verdict.why}`);
      console.log(`    > ${text.replace(/\n/g, "\n    > ")}${card ? `\n    ${card.replace(/\n/g, "\n    ")}` : ""}`);
    });
    const cost = usageCost(usageFile, start);
    const passed = results.filter((r) => r.pass).length;
    const secs = results.map((r) => r.seconds).sort((a, b) => a - b);
    arms.push({ model, passed, total: results.length, medianSeconds: secs[Math.floor(secs.length / 2)], slowestSeconds: secs.at(-1), coachUsd: cost.coach, judgeUsd: cost.judge });
    report.push(...results);
  }

  console.log("\nmodel | passed | median s | slowest s | coach $ | judge $");
  for (const a of arms) console.log(`${a.model} | ${a.passed}/${a.total} | ${a.medianSeconds?.toFixed(0)} | ${a.slowestSeconds?.toFixed(0)} | ${a.coachUsd.toFixed(3)} | ${a.judgeUsd.toFixed(3)}`);
  const out = path.join(__dirname, "runs", `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ arms, results: report }, null, 2));
  console.log(`\nreport: ${out}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
