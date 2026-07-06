import { Plan } from "@tsw/prisma";
import { differenceInCalendarDays } from "date-fns";
import { prisma } from "../../utils/prisma";

// Liveness ladder for plans whose content is planned by a connected agent
// (Plan.contentPlanner = EXTERNAL_AGENT). Presence means the agent WROTE
// state over MCP (Plan.externalAgentLastSyncAt) — reads don't count.
//
//   fresh (<3d): the agent owns week content; the coach stays on accountability.
//   stale (3-7d): the coach mentions the gap once, folded into normal contact.
//   dark  (>=7d): the coach resumes full planning and offers to take back over.
export const EXTERNAL_AGENT_FRESH_DAYS = 3;
export const EXTERNAL_AGENT_DARK_DAYS = 7;

// The curriculum file the connected agent keeps as the machine-readable
// progression contract (week N of M, this/next week items, days behind).
export const EXTERNAL_AGENT_STATUS_FILE = "status.md";
const STATUS_FILE_CONTEXT_MAX_CHARS = 2_000;

export type ExternalAgentPresenceTier = "fresh" | "stale" | "dark" | "never";

export function isExternalAgentManaged(
  plan: Pick<Plan, "contentPlanner">,
): boolean {
  return plan.contentPlanner === "EXTERNAL_AGENT";
}

export function getExternalAgentPresenceTier(
  lastSyncAt: Date | null | undefined,
  now: Date,
): ExternalAgentPresenceTier {
  if (!lastSyncAt) return "never";
  const days = differenceInCalendarDays(now, lastSyncAt);
  if (days < EXTERNAL_AGENT_FRESH_DAYS) return "fresh";
  if (days < EXTERNAL_AGENT_DARK_DAYS) return "stale";
  return "dark";
}

// The coach hands week-content planning to the agent only while the agent is
// alive. Once it goes dark (or never synced), the coach plans again.
export function coachDefersWeekContent(
  plan: Pick<Plan, "contentPlanner" | "externalAgentLastSyncAt">,
  now: Date,
): boolean {
  if (!isExternalAgentManaged(plan)) return false;
  const tier = getExternalAgentPresenceTier(plan.externalAgentLastSyncAt, now);
  return tier === "fresh" || tier === "stale";
}

export function daysSinceExternalAgentSync(
  plan: Pick<Plan, "externalAgentLastSyncAt">,
  now: Date,
): number | null {
  return plan.externalAgentLastSyncAt
    ? differenceInCalendarDays(now, plan.externalAgentLastSyncAt)
    : null;
}

// Last time the user's connected agent made ANY MCP call (reads included).
// Weaker signal than plan.externalAgentLastSyncAt: distinguishes "agent
// around but not syncing" from "agent gone entirely".
export async function getExternalAgentLastSeenAt(
  userId: string,
): Promise<Date | null> {
  const result = await prisma.apiKey.aggregate({
    where: { userId, revokedAt: null },
    _max: { lastUsedAt: true },
  });
  return result._max.lastUsedAt ?? null;
}

// Full content — parse signals (days_behind) from this, never from the
// context-truncated form.
export async function readExternalAgentStatusFile(
  planId: string,
): Promise<string | null> {
  const file = await prisma.planCurriculumFile.findUnique({
    where: { planId_path: { planId, path: EXTERNAL_AGENT_STATUS_FILE } },
    select: { content: true },
  });
  if (!file) return null;
  const content = file.content.trim();
  return content || null;
}

export function truncateStatusForContext(content: string): string {
  return content.length > STATUS_FILE_CONTEXT_MAX_CHARS
    ? `${content.slice(0, STATUS_FILE_CONTEXT_MAX_CHARS)}\n[truncated]`
    : content;
}

// Lenient parse of a "days_behind: N" line from the agent's status file.
export function parseStatusDaysBehind(content: string): number | null {
  const match = /days?[_ -]behind\s*[:=]\s*(-?\d+(?:\.\d+)?)/i.exec(content);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}
