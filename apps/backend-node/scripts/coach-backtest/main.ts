#!/usr/bin/env tsx
import dotenv from "dotenv";
import path from "path";
import type {
  ContactLog,
  DispatchSink,
} from "../../src/services/coach/concerns/reconciler";

type CliArgs = {
  username: string;
  from: Date;
  to: Date;
  stepHours: number;
  reset: boolean;
  verbose: boolean;
  content: boolean;
  model?: string;
  prod: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    username: "alex",
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
    stepHours: 1,
    reset: false,
    verbose: false,
    content: false,
    prod: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--username" && argv[i + 1]) args.username = argv[++i];
    else if (arg === "--from" && argv[i + 1]) args.from = new Date(argv[++i]);
    else if (arg === "--to" && argv[i + 1]) args.to = new Date(argv[++i]);
    else if (arg === "--step-hours" && argv[i + 1]) args.stepHours = Number(argv[++i]) || 1;
    else if (arg === "--reset") args.reset = true;
    else if (arg === "--verbose") args.verbose = true;
    else if (arg === "--content") args.content = true;
    else if (arg === "--model" && argv[i + 1]) args.model = argv[++i];
    else if (arg === "--prod") args.prod = true;
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  return args;
}

function loadEnv(prod: boolean): void {
  const backendRoot = path.resolve(__dirname, "../..");
  dotenv.config({ path: path.join(backendRoot, ".env") });
  if (prod) {
    dotenv.config({ path: path.join(backendRoot, ".env.prod"), override: true });
  }
}

function getDatabaseUrl(prod: boolean): string {
  const url = prod
    ? process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
    : process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error(prod ? "PROD_DATABASE_URL is not set" : "DEV_DATABASE_URL is not set");
  return url;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function printUsage(): void {
  console.log(
    [
      "Replay a user through a historical window against the CoachConcern ledger (dry-run).",
      "",
      "Usage:",
      "  pnpm --dir apps/backend-node coach:backtest --username alex --from 2026-06-13 --to 2026-06-16",
      "",
      "Options:",
      "  --username <name>   App username to replay. Default: alex.",
      "  --from <iso>        Window start (inclusive). Default: 7 days ago.",
      "  --to <iso>          Window end (inclusive). Default: now.",
      "  --step-hours <n>    Tick interval. Default: 1 (matches the hourly cron).",
      "  --reset             Delete the user's existing CoachConcern rows first.",
      "  --verbose           Print active ledger snapshot at every tick.",
      "  --prod              Read from PROD (.env.prod). Read-only; no notifications are sent.",
    ].join("\n")
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printUsage();

  loadEnv(args.prod);
  process.env.DATABASE_URL = getDatabaseUrl(args.prod);

  const { prisma } = await import("../../src/utils/prisma");
  const { runConcernDetection } = await import(
    "../../src/services/coach/concerns/detection"
  );
  const { runOutboundReconcile } = await import(
    "../../src/services/coach/concerns/reconciler"
  );
  const { coachConcernService } = await import(
    "../../src/services/coach/concerns/service"
  );
  const { coachAgentService } = await import("../../src/services/coach/agent");
  const { coachAssessmentService } = await import(
    "../../src/services/coach/assessment/service"
  );
  const { buildRecurrentCoachAssessmentPrompt } = await import(
    "../../src/services/coach/assessment/prompt"
  );
  const { formatCoachAttentionContext } = await import(
    "../../src/services/coachAttentionService"
  );

  // Map the dispatch's primary driver back onto the EXISTING proactive prompt
  // builders so generated content reflects today's prompts (no new prompt). The
  // folded secondary concerns/lenses are noted but not yet composed — that is the
  // step-3c "real sink" prompt, to confirm separately.
  const RECURRENT_BY_LENS: Record<string, string> = {
    week_recap: "WEEK_RECAP",
    week_start: "WEEK_PREP",
    session_prep: "SESSION_PREP",
    celebration: "CELEBRATION",
  };
  const CANDIDATE_TYPE_BY_KIND: Record<string, string> = {
    inactivity_archive: "INACTIVITY_ARCHIVE_PROPOSAL",
    inactivity_pause: "INACTIVITY_PAUSE_PROPOSAL",
    plan_adjustment: "PLAN_ADJUSTMENT",
  };

  function summaryContext(data: any): string {
    return [
      `Plan: ${data.goal ?? ""}`,
      `Current week state: ${data.weekState ?? "unknown"}`,
      `Last activity: ${data.daysSinceLastActivity != null ? `${data.daysSinceLastActivity} days ago` : "never"}`,
      `Recent sessions: ${data.completedSessionsThisWeek ?? 0}/${data.totalSessionsThisWeek ?? 0} completed, ${data.missedSessionsThisWeek ?? 0} missed`,
    ].join("\n");
  }

  function buildPromptForDispatch(
    concerns: Array<{ kind: string; planId: string | null; data: unknown }>,
    lenses: Array<{ kind: string; context: Record<string, unknown> }>
  ): { driver: string; prompt: string } {
    const top = concerns[0];
    if (top) {
      const data = (top.data ?? {}) as any;
      if (top.kind === "inactivity_checkin") {
        return {
          driver: top.kind,
          prompt: buildRecurrentCoachAssessmentPrompt({
            interventionType: "INACTIVITY_CHECKIN",
            reason: `${data.goal ?? "A plan"} has had no activity for ${data.daysSinceLastActivity ?? "several"} days.`,
            context: summaryContext(data),
          }),
        };
      }
      if (top.kind.startsWith("attention_")) {
        const item = data.attentionItem;
        return {
          driver: top.kind,
          prompt: coachAssessmentService.buildAgentInterventionPrompt({
            type: "PLAN_ATTENTION",
            reason: item?.title ?? "Plan needs attention",
            planIds: item?.planIds ?? (top.planId ? [top.planId] : []),
            context: item ? formatCoachAttentionContext([item]) : "",
            usesAgent: true,
            attentionItems: item ? [item] : [],
          } as any),
        };
      }
      return {
        driver: top.kind,
        prompt: coachAssessmentService.buildAgentInterventionPrompt({
          type: (CANDIDATE_TYPE_BY_KIND[top.kind] ?? "PLAN_ADJUSTMENT") as any,
          reason: `${data.goal ?? "A plan"} needs attention.`,
          planIds: top.planId ? [top.planId] : [],
          context: summaryContext(data),
          usesAgent: true,
        } as any),
      };
    }
    const lens = lenses[0];
    if (lens) {
      return {
        driver: lens.kind,
        prompt: buildRecurrentCoachAssessmentPrompt({
          interventionType: (RECURRENT_BY_LENS[lens.kind] ?? "WEEK_RECAP") as any,
          reason: `It is time for a ${lens.kind.replace("_", " ")}.`,
          context: JSON.stringify(lens.context),
        }),
      };
    }
    return { driver: "none", prompt: "" };
  }

  function summarizeProposals(drafts: any[]): string[] {
    const out: string[] = [];
    for (const draft of drafts) {
      for (const p of draft.planProposals ?? [])
        out.push(`plan-modification: ${p.planGoal} — ${p.description}`);
      for (const p of draft.planCreationProposals ?? [])
        out.push(`plan-creation: ${p.goal} — ${p.description}`);
      for (const p of draft.activityLogProposals ?? [])
        out.push(`activity-log: ${p.activityId} x${p.quantity ?? 1}`);
      for (const p of draft.activityEditProposals ?? [])
        out.push(`activity-edit: ${JSON.stringify(p.requested ?? p)}`);
    }
    return out;
  }

  async function loadHistoryAsOf(userId: string, asOf: Date) {
    const msgs = await prisma.message.findMany({
      where: {
        chat: { userId, type: "COACH" },
        role: { in: ["USER", "COACH"] },
        createdAt: { lte: asOf },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    return msgs
      .reverse()
      .map((m) => ({
        role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));
  }

  // Load every non-deleted plan; we reconstruct the as-of-T active set per tick
  // below (archive/create are time-aware; pause is approximated — see note).
  const user = await prisma.user.findFirst({
    where: { username: args.username },
    include: {
      plans: {
        where: { deletedAt: null },
        include: { activities: true, sessions: true, milestones: true },
      },
    },
  });
  if (!user) throw new Error(`User '${args.username}' not found in this database`);

  console.log(
    `\nBacktest: ${args.username} (${user.id}) | ${args.from.toISOString()} -> ${args.to.toISOString()} | step ${args.stepHours}h | ${user.plans.length} active plan(s)\n`
  );

  if (args.reset) {
    const deleted = await prisma.coachConcern.deleteMany({ where: { userId: user.id } });
    console.log(`Reset: cleared ${deleted.count} existing concern row(s).\n`);
  }

  const dispatches: Array<{
    at: string;
    concerns: string[];
    lenses: string[];
    driver?: string;
    messages?: string[];
    proposals?: string[];
    agentSkipped?: boolean;
  }> = [];

  const sink: DispatchSink = {
    async dispatch({ user: tickUser, now, concerns, lenses }) {
      const record: (typeof dispatches)[number] = {
        at: now.toISOString(),
        concerns: concerns.map(
          (c) => `${c.kind}${c.planId ? `(${c.planId.slice(-4)})` : ""}#${c.raisedCount}`
        ),
        lenses: lenses.map((l) => l.kind),
      };

      if (args.content) {
        const { driver, prompt } = buildPromptForDispatch(
          concerns as any,
          lenses as any
        );
        record.driver = driver;
        if (prompt) {
          const history = await loadHistoryAsOf(tickUser.id, now);
          const response = await coachAgentService.generateResponse({
            user: tickUser as any,
            message: prompt,
            conversationHistory: history,
            plans: tickUser.plans as any,
            ...(args.model ? { model: args.model } : {}),
          });
          if (response.skipped || response.draftMessages.length === 0) {
            record.agentSkipped = true;
          } else {
            record.messages = response.draftMessages.map((d: any) => d.content);
            record.proposals = summarizeProposals(response.draftMessages);
          }
        }
      }

      dispatches.push(record);
      return { messageId: null, notificationId: null };
    },
  };

  // In-memory last-contact tracking for the dry run (prod uses notifications).
  const contactByUser = new Map<string, Date>();
  const contactLog: ContactLog = {
    async lastContactAt(userId) {
      return contactByUser.get(userId) ?? null;
    },
    async record(userId, now) {
      contactByUser.set(userId, now);
    },
  };

  let tickCount = 0;
  for (let cursor = args.from; cursor <= args.to; cursor = addHours(cursor, args.stepHours)) {
    tickCount++;
    // As-of-T active set: plan existed by `cursor` and was not yet archived.
    // archivedAt is rewound (a plan archived after the cursor counts as active
    // then). isPaused is treated as active-at-T (pause history isn't replayed).
    const tickPlans = user.plans
      .filter(
        (plan) =>
          plan.createdAt <= cursor &&
          (!plan.archivedAt || plan.archivedAt > cursor)
      )
      .map((plan) => ({ ...plan, archivedAt: null, isPaused: false }));
    const tickUser = { ...user, plans: tickPlans };
    const detection = await runConcernDetection(tickUser, cursor);
    const reconcile = await runOutboundReconcile(
      tickUser,
      cursor,
      sink,
      contactLog
    );

    if (args.verbose) {
      const active = await coachConcernService.getActive(user.id);
      console.log(
        `${cursor.toISOString()}  observed=${detection.observed} stale=${detection.resolvedStale} reconcile=${reconcile.reason}` +
          (active.length
            ? `\n    ledger: ${active
                .map((c) => `${c.kind}${c.planId ? `(${c.planId.slice(-4)})` : ""}:${c.status}#${c.raisedCount}`)
                .join(", ")}`
            : "")
      );
    }
  }

  console.log(`\nTicks: ${tickCount}`);
  console.log(`\nWould-dispatch events (new pipeline): ${dispatches.length}`);
  for (const dispatch of dispatches) {
    const concerns = dispatch.concerns.length
      ? `concerns=[${dispatch.concerns.join(", ")}]`
      : "concerns=[]";
    const lenses = dispatch.lenses.length
      ? ` lenses=[${dispatch.lenses.join(", ")}]`
      : "";
    console.log(`\n  ${dispatch.at}  ${concerns}${lenses}`);
    if (args.content) {
      console.log(`    driver: ${dispatch.driver ?? "-"}`);
      if (dispatch.agentSkipped) {
        console.log("    agent chose not to send");
      } else if (dispatch.messages) {
        dispatch.messages.forEach((m, i) => console.log(`    message[${i}]: ${m}`));
        if (dispatch.proposals?.length) {
          dispatch.proposals.forEach((p) => console.log(`    proposal: ${p}`));
        } else {
          console.log("    proposal: (none)");
        }
      }
    }
  }

  // Compare against the COACH notifications actually sent in this window.
  const actual = await prisma.notification.findMany({
    where: {
      userId: user.id,
      type: "COACH",
      createdAt: { gte: args.from, lte: args.to },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, title: true, relatedData: true },
  });
  console.log(`\nActual COACH notifications sent in window (prod history): ${actual.length}`);
  for (const notification of actual) {
    const related = notification.relatedData as any;
    console.log(
      `  ${notification.createdAt.toISOString()}  ${related?.interventionType || "?"}  ${notification.title || ""}`
    );
  }

  console.log(
    `\nSummary: new pipeline would dispatch ${dispatches.length} message(s); prod actually sent ${actual.length}.\n`
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
