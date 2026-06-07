import { TZDate } from "@date-fns/tz";
import { Activity, Plan, PlanMilestone, PlanSession, User } from "@tsw/prisma";
import { endOfWeek, format, startOfDay } from "date-fns";

type AttentionPlan = Plan & {
  activities: Activity[];
  sessions: PlanSession[];
  milestones?: PlanMilestone[];
};

export type CoachAttentionKind =
  | "SPECIFIC_NO_FUTURE_SESSIONS"
  | "SPECIFIC_SCHEDULE_ENDING";

export type CoachAttentionItem = {
  dedupeKey: string;
  kind: CoachAttentionKind;
  severity: "critical" | "warning" | "info";
  planIds: string[];
  planGoal: string;
  planEmoji: string | null;
  title: string;
  message: string;
  facts: Array<{ label: string; value: string }>;
  primaryAction: {
    type: "ASK_COACH_TO_FIX";
    prompt: string;
  };
  generatedAt: string;
};

function isActivePlan(plan: Pick<Plan, "deletedAt" | "archivedAt" | "isPaused" | "finishingDate">, now: Date) {
  return (
    !plan.deletedAt &&
    !plan.archivedAt &&
    !plan.isPaused &&
    (!plan.finishingDate || plan.finishingDate > now)
  );
}

function dateKey(date: Date, timezone: string) {
  return format(new TZDate(date, timezone), "yyyy-MM-dd");
}

function planLabel(plan: Pick<Plan, "emoji" | "goal">) {
  return `${plan.emoji || ""} ${plan.goal}`.trim();
}

function buildRepairPrompt(plan: AttentionPlan, kind: CoachAttentionKind) {
  if (kind === "SPECIFIC_NO_FUTURE_SESSIONS") {
    return `Please repair the schedule for my plan "${plan.goal}". It is a specific dated-session plan, but it has no future sessions. Use the plan notes and current progress, then propose the next useful sessions.`;
  }

  return `Please extend the schedule for my plan "${plan.goal}". Its current dated sessions run out this week. Use the plan notes and current progress, then propose the next useful sessions.`;
}

export function deriveCoachAttentionItems(params: {
  user: Pick<User, "timezone">;
  plans: AttentionPlan[];
  now?: Date;
}): CoachAttentionItem[] {
  const now = params.now || new Date();
  const timezone = params.user.timezone || "UTC";
  const nowInTz = new TZDate(now, timezone);
  const todayKey = dateKey(startOfDay(nowInTz), timezone);
  const currentWeekEndKey = dateKey(endOfWeek(nowInTz, { weekStartsOn: 0 }), timezone);
  const generatedAt = now.toISOString();
  const items: CoachAttentionItem[] = [];

  for (const plan of params.plans) {
    if (!isActivePlan(plan, now)) continue;
    if (plan.outlineType !== "SPECIFIC") continue;

    const sessions = [...(plan.sessions || [])].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    const futureSessions = sessions.filter(
      (session) => dateKey(session.date, timezone) >= todayKey
    );
    const sessionsAfterCurrentWeek = futureSessions.filter(
      (session) => dateKey(session.date, timezone) > currentWeekEndKey
    );
    const lastSession = sessions[sessions.length - 1];
    const nextSession = futureSessions[0];
    const label = planLabel(plan);
    const finishingDate = plan.finishingDate
      ? dateKey(plan.finishingDate, timezone)
      : "No end date";

    if (futureSessions.length === 0) {
      items.push({
        dedupeKey: `${plan.id}:SPECIFIC_NO_FUTURE_SESSIONS`,
        kind: "SPECIFIC_NO_FUTURE_SESSIONS",
        severity: "critical",
        planIds: [plan.id],
        planGoal: plan.goal,
        planEmoji: plan.emoji || null,
        title: `${label} has no active schedule`,
        message:
          "This specific plan has no dated sessions left, so the app cannot guide the next step.",
        facts: [
          { label: "Future sessions", value: "0" },
          {
            label: "Last planned session",
            value: lastSession ? dateKey(lastSession.date, timezone) : "None",
          },
          { label: "Plan end", value: finishingDate },
        ],
        primaryAction: {
          type: "ASK_COACH_TO_FIX",
          prompt: buildRepairPrompt(plan, "SPECIFIC_NO_FUTURE_SESSIONS"),
        },
        generatedAt,
      });
      continue;
    }

    if (sessionsAfterCurrentWeek.length === 0 && (!plan.finishingDate || dateKey(plan.finishingDate, timezone) > currentWeekEndKey)) {
      items.push({
        dedupeKey: `${plan.id}:SPECIFIC_SCHEDULE_ENDING`,
        kind: "SPECIFIC_SCHEDULE_ENDING",
        severity: "warning",
        planIds: [plan.id],
        planGoal: plan.goal,
        planEmoji: plan.emoji || null,
        title: `${label} schedule runs out this week`,
        message:
          "This specific plan has dated sessions this week, but nothing planned after that.",
        facts: [
          { label: "Next session", value: nextSession ? dateKey(nextSession.date, timezone) : "None" },
          { label: "Future sessions", value: `${futureSessions.length}` },
          {
            label: "Last planned session",
            value: lastSession ? dateKey(lastSession.date, timezone) : "None",
          },
          { label: "Plan end", value: finishingDate },
        ],
        primaryAction: {
          type: "ASK_COACH_TO_FIX",
          prompt: buildRepairPrompt(plan, "SPECIFIC_SCHEDULE_ENDING"),
        },
        generatedAt,
      });
    }
  }

  return items.sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title);
  });
}

export function formatCoachAttentionContext(items: CoachAttentionItem[]) {
  if (items.length === 0) return "";

  return [
    "COACH ATTENTION ITEMS:",
    ...items.map((item) => {
      const facts = item.facts.map((fact) => `${fact.label}: ${fact.value}`).join("; ");
      return `- [${item.severity}] ${item.title}. ${item.message} Facts: ${facts}`;
    }),
  ].join("\n");
}
