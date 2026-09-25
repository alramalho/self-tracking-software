import { TZDate } from "@date-fns/tz";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { User } from "@tsw/prisma";
import {
  addDaysToDateKey,
  buildPlanWeekProjection,
} from "@tsw/prisma/plan-week";
import { differenceInCalendarDays, format } from "date-fns";
import { NextFunction, Response, Router } from "express";
import { z } from "zod/v4";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  CURRICULUM_MAX_FILE_BYTES,
  CURRICULUM_MAX_FILES,
  curriculumFileSchema,
  findDuplicatePaths,
  listCurriculumFiles,
  replaceCurriculum,
  upsertCurriculumFiles,
} from "../services/planCurriculumService";
import {
  executePlanProposalPatch,
  type PlanProposalPatch,
} from "../services/planProposalPatchService";
import { plansService } from "../services/plansService";
import { hashApiKey } from "./apiKeys";
import { logger } from "../utils/logger";
import { setRequestContext } from "../utils/requestContext";
import { prisma } from "../utils/prisma";

const router = Router();

async function requireApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer tsk_")) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message:
          "Unauthorized. Pass a personal API key as 'Authorization: Bearer tsk_...'.",
      },
      id: null,
    });
    return;
  }

  const key = authHeader.substring(7);
  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash: hashApiKey(key), revokedAt: null },
    include: { user: true },
  });

  if (!apiKey || apiKey.user.deletedAt) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Invalid or revoked API key" },
      id: null,
    });
    return;
  }

  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  req.user = apiKey.user;
  // Lets AI side effects (e.g. auto-categorising) respect this person's AI consent.
  setRequestContext({ user: apiKey.user });
  next();
}

function textResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

async function findOwnedPlan(planId: string, userId: string) {
  return prisma.plan.findFirst({
    where: { id: planId, userId, deletedAt: null },
    select: { id: true, goal: true },
  });
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  // Reject calendar-invalid dates (2026-02-31) that Date.UTC silently rolls over.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

// Presence for the coach's liveness ladder: a write over MCP means the
// connected agent synced state. Best-effort — never fails the tool call.
async function stampExternalAgentSync(planIds: string[]): Promise<void> {
  if (planIds.length === 0) return;
  try {
    await prisma.plan.updateMany({
      where: { id: { in: planIds } },
      data: { externalAgentLastSyncAt: new Date() },
    });
  } catch (error) {
    logger.error("[mcp] failed to stamp externalAgentLastSyncAt:", error);
  }
}

function buildMcpServer(user: User): McpServer {
  const server = new McpServer({
    name: "tracking-so",
    version: "1.0.0",
  });

  server.registerTool(
    "get_user_state",
    {
      title: "Get user state",
      description:
        "Get an overview of the user's tracking.so account: profile, active plans with this-week and next-week schedules, milestones, curriculum attachment, sync state, and recent logging. Call this first to decide whether the user needs onboarding (no plans), plan repairs, or is on track.",
      inputSchema: {},
    },
    async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [plans, recentEntries] = await Promise.all([
        prisma.plan.findMany({
          where: { userId: user.id, deletedAt: null, archivedAt: null },
          select: {
            id: true,
            goal: true,
            emoji: true,
            outlineType: true,
            timesPerWeek: true,
            finishingDate: true,
            isPaused: true,
            currentWeekState: true,
            contentPlanner: true,
            externalAgentLastSyncAt: true,
            _count: { select: { curriculumFiles: true } },
            sessions: {
              select: {
                id: true,
                date: true,
                activityId: true,
                quantity: true,
                descriptiveGuide: true,
              },
            },
            activities: {
              select: { id: true, title: true, emoji: true, measure: true },
            },
            milestones: {
              select: { description: true, date: true, progress: true },
              orderBy: { date: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.activityEntry.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
            datetime: { gte: thirtyDaysAgo },
          },
          select: { datetime: true, activityId: true },
        }),
      ]);

      const projection = buildPlanWeekProjection({
        plans,
        entries: recentEntries,
        now,
        timezone: user.timezone,
        weekCount: 2,
      });
      const activityTitleById = new Map(
        plans.flatMap((plan) =>
          plan.activities.map((activity) => [activity.id, activity.title]),
        ),
      );

      // Sessions come from the raw rows (not the projection) so ids are
      // round-trippable via upsert_sessions and TIMES_PER_WEEK day-placement
      // hints stay visible. @db.Date is UTC midnight; slice gives the stored day.
      const buildWeekView = (
        plan: (typeof plans)[number],
        weekIndex: number,
      ) => {
        const weekStartKey = addDaysToDateKey(
          projection.weekStartKey,
          weekIndex * 7,
        );
        const weekEndExclusiveKey = addDaysToDateKey(weekStartKey, 7);
        const sessions = plan.sessions
          .map((session) => ({
            ...session,
            dateKey: session.date.toISOString().slice(0, 10),
          }))
          .filter(
            (session) =>
              session.dateKey >= weekStartKey &&
              session.dateKey < weekEndExclusiveKey,
          )
          .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
          .map((session) => ({
            id: session.id,
            date: session.dateKey,
            activityTitle: activityTitleById.get(session.activityId) ?? null,
            quantity: session.quantity,
            descriptiveGuide: session.descriptiveGuide || undefined,
          }));
        const summary = projection.summaries.find(
          (item) => item.planId === plan.id && item.weekIndex === weekIndex,
        );
        return {
          weekStart: weekStartKey,
          sessions,
          // TIMES_PER_WEEK plans get a computed weekly summary; SPECIFIC
          // plans are defined by their dated sessions alone.
          target: summary?.target ?? null,
          completedDays: summary?.completedDays ?? null,
          remaining: summary?.remaining ?? null,
          openDays: summary?.openDays ?? null,
          status: summary?.status ?? null,
        };
      };

      return textResult({
        profile: {
          username: user.username,
          name: user.name,
          timezone: user.timezone,
          planType: user.planType,
          proactiveCoachingEnabled: user.proactiveCoachingEnabled,
        },
        plans: plans.map((plan) => {
          const planActivityIds = new Set(
            plan.activities.map((activity) => activity.id),
          );
          const lastPlanEntry = recentEntries
            .filter(
              (entry) =>
                entry.activityId && planActivityIds.has(entry.activityId),
            )
            .reduce<Date | null>(
              (latest, entry) =>
                !latest || entry.datetime > latest ? entry.datetime : latest,
              null,
            );
          return {
            planId: plan.id,
            goal: plan.goal,
            emoji: plan.emoji,
            outlineType: plan.outlineType,
            timesPerWeek: plan.timesPerWeek,
            finishingDate: plan.finishingDate,
            isPaused: plan.isPaused,
            currentWeekState: plan.currentWeekState,
            contentPlanner: plan.contentPlanner,
            lastAgentSyncAt: plan.externalAgentLastSyncAt,
            futureSessions: plan.sessions.filter((s) => s.date >= now).length,
            pastEndDate: !!plan.finishingDate && plan.finishingDate < now,
            curriculumFiles: plan._count.curriculumFiles,
            daysSinceLastActivity: lastPlanEntry
              ? differenceInCalendarDays(now, lastPlanEntry)
              : null,
            milestones: plan.milestones.map((milestone) => ({
              description: milestone.description,
              // @db.Date is UTC midnight; server-local format() would shift it.
              date: milestone.date.toISOString().slice(0, 10),
              progress: milestone.progress ?? 0,
            })),
            thisWeek: buildWeekView(plan, 0),
            nextWeek: buildWeekView(plan, 1),
          };
        }),
        activity: {
          entriesLast7Days: recentEntries.filter(
            (entry) => entry.datetime >= sevenDaysAgo
          ).length,
          entriesLast30Days: recentEntries.length,
        },
        appUrl: "https://app.tracking.so",
      });
    }
  );

  server.registerTool(
    "create_plan",
    {
      title: "Create plan",
      description:
        "Create a new plan for the user. Use TIMES_PER_WEEK with timesPerWeek for frequency habits, or SPECIFIC with dated sessions for structured curricula. Activities are matched to existing ones by title (case-insensitive) or created. Confirm goal, emoji, schedule shape, and finishing date with the user before calling.",
      inputSchema: {
        goal: z.string().min(1).max(200),
        emoji: z.string().max(8).optional(),
        goalReason: z
          .string()
          .max(500)
          .optional()
          .describe("Why the user wants this, in their words"),
        notes: z.string().max(5000).optional(),
        outlineType: z.enum(["SPECIFIC", "TIMES_PER_WEEK"]),
        timesPerWeek: z
          .number()
          .int()
          .min(1)
          .max(7)
          .optional()
          .describe("Required when outlineType is TIMES_PER_WEEK"),
        finishingDate: z
          .string()
          .optional()
          .describe("YYYY-MM-DD. Recommended so the plan has a clear end"),
        activities: z
          .array(
            z.object({
              title: z.string().min(1).max(100),
              measure: z
                .string()
                .min(1)
                .max(50)
                .describe("Unit, e.g. minutes, sessions, pages"),
              emoji: z.string().max(8),
            })
          )
          .min(1)
          .max(10),
        sessions: z
          .array(
            z.object({
              activityTitle: z.string().describe("Must match an activity title"),
              date: z.string().describe("YYYY-MM-DD"),
              quantity: z.number().int().min(1),
              descriptiveGuide: z
                .string()
                .max(2000)
                .optional()
                .describe("What to do in this session"),
            })
          )
          .max(200)
          .optional()
          .describe("Dated sessions for SPECIFIC plans"),
        milestones: z
          .array(
            z.object({
              description: z.string().min(1).max(300),
              date: z.string().describe("YYYY-MM-DD"),
            })
          )
          .max(20)
          .optional(),
        contentPlanner: z
          .enum(["COACH", "EXTERNAL_AGENT"])
          .optional()
          .describe(
            "Who plans this plan's week content. Set EXTERNAL_AGENT when you will maintain the schedule and curriculum yourself; the in-app coach then stays on accountability while you keep syncing. Defaults to COACH."
          ),
      },
    },
    async (input) => {
      if (input.outlineType === "TIMES_PER_WEEK" && !input.timesPerWeek) {
        return errorResult("timesPerWeek is required for TIMES_PER_WEEK plans");
      }
      if (
        input.outlineType === "SPECIFIC" &&
        (!input.sessions || input.sessions.length === 0)
      ) {
        return errorResult(
          "SPECIFIC plans need at least one dated session. Provide sessions or use TIMES_PER_WEEK."
        );
      }

      const finishingDate = parseDateOnly(input.finishingDate);
      if (input.finishingDate && !finishingDate) {
        return errorResult("finishingDate must be YYYY-MM-DD");
      }

      const plan = await prisma.$transaction(async (tx) => {
        const activityIdsByTitle = new Map<string, string>();
        for (const activity of input.activities) {
          const existing = await tx.activity.findFirst({
            where: {
              userId: user.id,
              deletedAt: null,
              title: { equals: activity.title, mode: "insensitive" },
            },
          });
          const saved =
            existing ||
            (await tx.activity.create({
              data: {
                userId: user.id,
                title: activity.title,
                measure: activity.measure,
                emoji: activity.emoji,
                kind: "other",
              },
            }));
          activityIdsByTitle.set(activity.title.toLowerCase(), saved.id);
        }

        const sessionCreates: Array<{
          activityId: string;
          date: Date;
          quantity: number;
          descriptiveGuide: string;
        }> = [];
        for (const session of input.sessions || []) {
          const activityId = activityIdsByTitle.get(
            session.activityTitle.toLowerCase()
          );
          if (!activityId) {
            throw new Error(
              `Session activity "${session.activityTitle}" is not in the activities list`
            );
          }
          const date = parseDateOnly(session.date);
          if (!date) {
            throw new Error(`Session date "${session.date}" must be YYYY-MM-DD`);
          }
          sessionCreates.push({
            activityId,
            date,
            quantity: session.quantity,
            descriptiveGuide: session.descriptiveGuide || "",
          });
        }

        const milestoneCreates: Array<{
          description: string;
          date: Date;
          progress: number;
        }> = [];
        for (const milestone of input.milestones || []) {
          const date = parseDateOnly(milestone.date);
          if (!date) {
            throw new Error(
              `Milestone date "${milestone.date}" must be YYYY-MM-DD`
            );
          }
          milestoneCreates.push({
            description: milestone.description,
            date,
            progress: 0,
          });
        }

        return tx.plan.create({
          data: {
            userId: user.id,
            goal: input.goal,
            goalReason: input.goalReason || null,
            notes: input.notes || null,
            emoji: input.emoji || "🎯",
            finishingDate,
            contentPlanner: input.contentPlanner || "COACH",
            externalAgentLastSyncAt: new Date(),
            outlineType: input.outlineType,
            timesPerWeek:
              input.outlineType === "TIMES_PER_WEEK"
                ? input.timesPerWeek
                : null,
            activities: {
              connect: Array.from(activityIdsByTitle.values()).map((id) => ({
                id,
              })),
            },
            sessions:
              sessionCreates.length > 0
                ? { create: sessionCreates }
                : undefined,
            milestones:
              milestoneCreates.length > 0
                ? { create: milestoneCreates }
                : undefined,
          },
          select: {
            id: true,
            goal: true,
            emoji: true,
            outlineType: true,
            timesPerWeek: true,
            finishingDate: true,
            _count: { select: { sessions: true, milestones: true } },
          },
        });
      });

      logger.info(
        `[mcp] user=${user.username} created plan "${plan.goal}" (${plan.id})`
      );
      return textResult({
        success: true,
        planId: plan.id,
        goal: plan.goal,
        emoji: plan.emoji,
        outlineType: plan.outlineType,
        timesPerWeek: plan.timesPerWeek,
        finishingDate: plan.finishingDate,
        sessions: plan._count.sessions,
        milestones: plan._count.milestones,
        nextStep:
          "If the user has a self-built curriculum (markdown files), attach it with replace_curriculum so the coach plans from it.",
      });
    }
  );

  server.registerTool(
    "update_plan",
    {
      title: "Update plan",
      description:
        "Update an existing plan's fields: finishing date, notes, goal, weekly frequency, milestones, or who plans its week content. Use this to renegotiate a finishing date the user agreed to, keep milestones' progress honest, or mark a plan as maintained by you (contentPlanner EXTERNAL_AGENT). Confirm changes with the user first.",
      inputSchema: {
        planId: z.string(),
        goal: z.string().min(1).max(200).optional(),
        notes: z.string().max(5000).nullable().optional(),
        finishingDate: z
          .string()
          .nullable()
          .optional()
          .describe("YYYY-MM-DD, or null to clear"),
        timesPerWeek: z.number().int().min(1).max(7).optional(),
        contentPlanner: z
          .enum(["COACH", "EXTERNAL_AGENT"])
          .optional()
          .describe(
            "EXTERNAL_AGENT: you own week content and keep it synced; the in-app coach stays on accountability. COACH: hand week planning back to the in-app coach."
          ),
        milestones: z
          .array(
            z.object({
              id: z
                .string()
                .optional()
                .describe("Existing milestone id to update; omit to create"),
              description: z.string().min(1).max(300),
              date: z.string().describe("YYYY-MM-DD"),
              progress: z.number().int().min(0).max(100).optional(),
            })
          )
          .max(20)
          .optional(),
      },
    },
    async (input) => {
      const plan = await findOwnedPlan(input.planId, user.id);
      if (!plan) return errorResult("Plan not found");
      if (input.finishingDate && !parseDateOnly(input.finishingDate)) {
        return errorResult("finishingDate must be YYYY-MM-DD");
      }
      for (const milestone of input.milestones || []) {
        if (!parseDateOnly(milestone.date)) {
          return errorResult(
            `Milestone date "${milestone.date}" must be YYYY-MM-DD`
          );
        }
      }

      const planPatch: NonNullable<PlanProposalPatch["plan"]> = {};
      if (input.goal !== undefined) planPatch.goal = input.goal;
      if (input.notes !== undefined) planPatch.notes = input.notes;
      if (input.finishingDate !== undefined) {
        planPatch.finishingDate = input.finishingDate;
      }
      if (input.timesPerWeek !== undefined) {
        planPatch.timesPerWeek = input.timesPerWeek;
      }

      const patch: PlanProposalPatch = {};
      if (Object.keys(planPatch).length > 0) patch.plan = planPatch;
      if (input.milestones && input.milestones.length > 0) {
        patch.milestones = { upsert: input.milestones };
      }

      try {
        // Idempotent write first: if the milestone-carrying patch fails after
        // it, a verbatim retry cannot duplicate milestones.
        if (input.contentPlanner) {
          await prisma.plan.update({
            where: { id: input.planId },
            data: { contentPlanner: input.contentPlanner },
          });
        }
        if (patch.plan || patch.milestones) {
          await executePlanProposalPatch({
            planId: input.planId,
            patch,
            userId: user.id,
          });
        }
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : "Plan update failed"
        );
      }
      await stampExternalAgentSync([input.planId]);

      const updated = await prisma.plan.findUnique({
        where: { id: input.planId },
        select: {
          goal: true,
          notes: true,
          finishingDate: true,
          timesPerWeek: true,
          contentPlanner: true,
          milestones: {
            select: { id: true, description: true, date: true, progress: true },
            orderBy: { date: "asc" },
          },
        },
      });
      logger.info(
        `[mcp] user=${user.username} updated plan ${input.planId}`
      );
      return textResult({ success: true, planId: input.planId, plan: updated });
    }
  );

  server.registerTool(
    "upsert_sessions",
    {
      title: "Upsert sessions",
      description:
        "Add, update, or delete dated sessions on an existing plan — use this to extend the schedule week by week as the curriculum progresses. Sessions you create are marked agent-suggested; on TIMES_PER_WEEK plans they act as day-placement hints rather than extra targets. Schedule 1-2 weeks ahead, not the whole plan.",
      inputSchema: {
        planId: z.string(),
        sessions: z
          .array(
            z.object({
              id: z
                .string()
                .optional()
                .describe("Existing session id to update; omit to create"),
              activityTitle: z
                .string()
                .optional()
                .describe(
                  "Must match one of the plan's activities. Required for new sessions"
                ),
              date: z.string().optional().describe("YYYY-MM-DD"),
              quantity: z.number().int().min(1).optional(),
              descriptiveGuide: z.string().max(2000).optional(),
            })
          )
          .max(100)
          .optional(),
        deleteIds: z.array(z.string()).max(200).optional(),
      },
    },
    async (input) => {
      const plan = await prisma.plan.findFirst({
        where: { id: input.planId, userId: user.id, deletedAt: null },
        select: {
          id: true,
          goal: true,
          activities: { select: { id: true, title: true } },
          sessions: { select: { id: true, activityId: true, date: true } },
        },
      });
      if (!plan) return errorResult("Plan not found");
      if (!input.sessions?.length && !input.deleteIds?.length) {
        return errorResult("Provide sessions to upsert or deleteIds");
      }

      const activityIdByTitle = new Map(
        plan.activities.map((activity) => [
          activity.title.toLowerCase(),
          activity.id,
        ])
      );
      // Same activity + same day already scheduled -> update instead of
      // create, so re-syncs never accumulate duplicate sessions.
      const existingSessionByKey = new Map(
        plan.sessions.map((session) => [
          `${session.activityId}:${session.date.toISOString().slice(0, 10)}`,
          session.id,
        ])
      );
      const upserts: Array<{
        id?: string;
        activityId?: string;
        date?: string;
        quantity?: number;
        descriptiveGuide?: string;
      }> = [];
      for (const session of input.sessions || []) {
        let activityId: string | undefined;
        if (session.activityTitle) {
          activityId = activityIdByTitle.get(session.activityTitle.toLowerCase());
          if (!activityId) {
            return errorResult(
              `Activity "${session.activityTitle}" is not on this plan. Plan activities: ${plan.activities.map((a) => a.title).join(", ") || "none"}`
            );
          }
        }
        if (!session.id && (!activityId || !session.date || !session.quantity)) {
          return errorResult(
            "New sessions need activityTitle, date, and quantity"
          );
        }
        if (session.date && !parseDateOnly(session.date)) {
          return errorResult(`Session date "${session.date}" must be YYYY-MM-DD`);
        }
        const dedupedId =
          session.id ??
          (activityId && session.date
            ? existingSessionByKey.get(`${activityId}:${session.date}`)
            : undefined);
        upserts.push({
          id: dedupedId,
          activityId,
          date: session.date,
          quantity: session.quantity,
          descriptiveGuide: session.descriptiveGuide,
        });
      }

      let sessionChanges: Array<{ operation: string; id?: string }> = [];
      try {
        const { changes } = await executePlanProposalPatch({
          planId: input.planId,
          patch: {
            sessions: {
              upsert: upserts,
              deleteIds: input.deleteIds,
            },
          },
          userId: user.id,
        });
        sessionChanges = changes
          .filter((change) => change.entity === "session")
          .map(({ operation, id }) => ({ operation, id }));
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : "Session upsert failed"
        );
      }
      await stampExternalAgentSync([input.planId]);

      const now = new Date();
      const futureSessions = await prisma.planSession.count({
        where: { planId: input.planId, date: { gte: now } },
      });
      logger.info(
        `[mcp] user=${user.username} upserted sessions plan=${input.planId} upserts=${upserts.length} deletes=${input.deleteIds?.length ?? 0}`
      );
      return textResult({
        success: true,
        planId: input.planId,
        changes: sessionChanges,
        deleted: input.deleteIds?.length ?? 0,
        futureSessions,
      });
    }
  );

  server.registerTool(
    "log_activity",
    {
      title: "Log activity",
      description:
        "Log an activity entry for the user — record work that actually happened (e.g. after a study session). Logging feeds streaks, weekly targets, and the coach's picture of adherence. If an entry for the same activity and day exists, the quantity is added to it. Only log work the user confirmed doing.",
      inputSchema: {
        activityTitle: z
          .string()
          .describe("Must match one of the user's existing activities"),
        date: z.string().describe("YYYY-MM-DD, the user's local day"),
        quantity: z.number().int().min(1).describe("Whole number, in the activity's measure"),
        description: z.string().max(1000).optional(),
      },
    },
    async (input) => {
      const activity = await prisma.activity.findFirst({
        where: {
          userId: user.id,
          deletedAt: null,
          title: { equals: input.activityTitle, mode: "insensitive" },
        },
      });
      if (!activity) {
        const titles = await prisma.activity.findMany({
          where: { userId: user.id, deletedAt: null },
          select: { title: true },
          take: 20,
        });
        return errorResult(
          `Activity "${input.activityTitle}" not found. Existing activities: ${titles.map((t) => t.title).join(", ") || "none"}`
        );
      }

      const validDate = parseDateOnly(input.date);
      if (!validDate) return errorResult("date must be a valid YYYY-MM-DD");
      const year = validDate.getUTCFullYear();
      const monthIndex = validDate.getUTCMonth();
      const day = validDate.getUTCDate();
      const timezone = user.timezone || "UTC";
      // Local calendar-day bounds via TZDate (not +24h): DST days are 23/25h.
      const dayStart = new Date(
        new TZDate(year, monthIndex, day, 0, 0, 0, timezone).getTime()
      );
      const dayEnd = new Date(
        new TZDate(year, monthIndex, day + 1, 0, 0, 0, timezone).getTime()
      );
      const entryDatetime = new Date(
        new TZDate(year, monthIndex, day, 12, 0, 0, timezone).getTime()
      );

      // Same-local-day merge: MCP logs are date-granular, so exact-datetime
      // matching (the in-app rule) would always duplicate. One day, one entry.
      const existingEntry = await prisma.activityEntry.findFirst({
        where: {
          userId: user.id,
          activityId: activity.id,
          deletedAt: null,
          datetime: { gte: dayStart, lt: dayEnd },
        },
      });

      const entry = existingEntry
        ? await prisma.activityEntry.update({
            where: { id: existingEntry.id },
            data: {
              quantity: existingEntry.quantity + input.quantity,
              description: input.description || existingEntry.description,
            },
          })
        : await prisma.activityEntry.create({
            data: {
              userId: user.id,
              activityId: activity.id,
              quantity: input.quantity,
              datetime: entryDatetime,
              timezone,
              description: input.description || null,
              source: "mcp",
            },
          });

      const affectedPlans = await prisma.plan.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          archivedAt: null,
          activities: { some: { id: activity.id } },
        },
      });
      await Promise.all([
        prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        }),
        prisma.plan.updateMany({
          where: { id: { in: affectedPlans.map((p) => p.id) } },
          data: { progressCalculatedAt: null },
        }),
      ]);
      if (user.planType === "PLUS") {
        for (const affectedPlan of affectedPlans) {
          void plansService
            .recalculateCurrentWeekState(affectedPlan, user)
            .catch((error) =>
              logger.error(
                `[mcp] week state recalc failed plan=${affectedPlan.id}:`,
                error
              )
            );
        }
      }
      await stampExternalAgentSync(affectedPlans.map((p) => p.id));

      logger.info(
        `[mcp] user=${user.username} logged ${input.quantity} ${activity.measure} of "${activity.title}" on ${input.date}${existingEntry ? " (merged)" : ""}`
      );
      return textResult({
        success: true,
        entryId: entry.id,
        activityTitle: activity.title,
        date: input.date,
        merged: !!existingEntry,
        quantityForDay: entry.quantity,
        plansTouched: affectedPlans.map((p) => p.goal),
      });
    }
  );

  server.registerTool(
    "list_plans",
    {
      title: "List plans",
      description:
        "List the user's active plans with their schedule state and curriculum file count. Use the returned plan ids with the curriculum tools.",
      inputSchema: {},
    },
    async () => {
      const now = new Date();
      const plans = await prisma.plan.findMany({
        where: { userId: user.id, deletedAt: null, archivedAt: null },
        select: {
          id: true,
          goal: true,
          emoji: true,
          outlineType: true,
          timesPerWeek: true,
          finishingDate: true,
          isPaused: true,
          contentPlanner: true,
          externalAgentLastSyncAt: true,
          _count: { select: { curriculumFiles: true } },
          sessions: { select: { date: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return textResult(
        plans.map((plan) => ({
          planId: plan.id,
          goal: plan.goal,
          emoji: plan.emoji,
          outlineType: plan.outlineType,
          timesPerWeek: plan.timesPerWeek,
          finishingDate: plan.finishingDate,
          isPaused: plan.isPaused,
          contentPlanner: plan.contentPlanner,
          lastAgentSyncAt: plan.externalAgentLastSyncAt,
          futureSessions: plan.sessions.filter((s) => s.date >= now).length,
          curriculumFiles: plan._count.curriculumFiles,
        }))
      );
    }
  );

  server.registerTool(
    "list_curriculum_files",
    {
      title: "List curriculum files",
      description: "List the curriculum files attached to a plan.",
      inputSchema: { planId: z.string() },
    },
    async ({ planId }) => {
      const plan = await findOwnedPlan(planId, user.id);
      if (!plan) return errorResult("Plan not found");
      const files = await listCurriculumFiles(planId);
      return textResult({ planId, planGoal: plan.goal, files });
    }
  );

  server.registerTool(
    "read_curriculum_file",
    {
      title: "Read curriculum file",
      description:
        "Read one curriculum file attached to a plan. Returns the raw markdown.",
      inputSchema: { planId: z.string(), path: z.string() },
    },
    async ({ planId, path }) => {
      const plan = await findOwnedPlan(planId, user.id);
      if (!plan) return errorResult("Plan not found");
      const file = await prisma.planCurriculumFile.findUnique({
        where: { planId_path: { planId, path } },
      });
      if (!file) return errorResult("Curriculum file not found");
      return {
        content: [{ type: "text" as const, text: file.content }],
      };
    }
  );

  const filesInput = {
    planId: z.string(),
    files: z
      .array(curriculumFileSchema)
      .min(1)
      .max(CURRICULUM_MAX_FILES)
      .describe(
        `Markdown files as {path, content}. Relative paths, max ${CURRICULUM_MAX_FILES} files, ${CURRICULUM_MAX_FILE_BYTES} bytes each.`
      ),
  };

  server.registerTool(
    "replace_curriculum",
    {
      title: "Replace curriculum",
      description:
        "Replace the full curriculum bundle attached to a plan. Files not included are removed. Use upsert_curriculum_files to update a subset instead.",
      inputSchema: filesInput,
    },
    async ({ planId, files }) => {
      const plan = await findOwnedPlan(planId, user.id);
      if (!plan) return errorResult("Plan not found");
      const duplicates = findDuplicatePaths(files);
      if (duplicates.length > 0) {
        return errorResult(`Duplicate file paths: ${duplicates.join(", ")}`);
      }
      const { fileCount } = await replaceCurriculum(planId, files);
      await stampExternalAgentSync([planId]);
      logger.info(
        `[mcp] user=${user.username} replaced curriculum plan=${planId} files=${fileCount}`
      );
      return textResult({ success: true, planId, fileCount });
    }
  );

  server.registerTool(
    "upsert_curriculum_files",
    {
      title: "Upsert curriculum files",
      description:
        "Create or update specific curriculum files on a plan without touching the others.",
      inputSchema: filesInput,
    },
    async ({ planId, files }) => {
      const plan = await findOwnedPlan(planId, user.id);
      if (!plan) return errorResult("Plan not found");
      const duplicates = findDuplicatePaths(files);
      if (duplicates.length > 0) {
        return errorResult(`Duplicate file paths: ${duplicates.join(", ")}`);
      }
      const { fileCount } = await upsertCurriculumFiles(planId, files);
      await stampExternalAgentSync([planId]);
      logger.info(
        `[mcp] user=${user.username} upserted curriculum plan=${planId} files=${fileCount}`
      );
      return textResult({ success: true, planId, fileCount });
    }
  );

  return server;
}

// Stateless streamable HTTP: one server+transport pair per request.
router.post("/", requireApiKey, async (req: AuthenticatedRequest, res) => {
  try {
    const server = buildMcpServer(req.user!);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error("MCP request failed:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

const methodNotAllowed = (_req: AuthenticatedRequest, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed" },
    id: null,
  });
};
router.get("/", methodNotAllowed);
router.delete("/", methodNotAllowed);

export const mcpRouter: Router = router;
export default mcpRouter;
