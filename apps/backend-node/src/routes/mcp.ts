import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { User } from "@tsw/prisma";
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
import { hashApiKey } from "./apiKeys";
import { logger } from "../utils/logger";
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
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  return Number.isNaN(date.getTime()) ? null : date;
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
        "Get an overview of the user's tracking.so account: profile, active plans with schedule health, curriculum attachment, and recent logging activity. Call this first to decide whether the user needs onboarding (no plans), plan repairs (plans without future sessions), or is on track.",
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
            _count: { select: { curriculumFiles: true } },
            sessions: { select: { date: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.activityEntry.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
            datetime: { gte: thirtyDaysAgo },
          },
          select: { datetime: true },
        }),
      ]);

      return textResult({
        profile: {
          username: user.username,
          name: user.name,
          timezone: user.timezone,
          planType: user.planType,
          proactiveCoachingEnabled: user.proactiveCoachingEnabled,
        },
        plans: plans.map((plan) => ({
          planId: plan.id,
          goal: plan.goal,
          emoji: plan.emoji,
          outlineType: plan.outlineType,
          timesPerWeek: plan.timesPerWeek,
          finishingDate: plan.finishingDate,
          isPaused: plan.isPaused,
          currentWeekState: plan.currentWeekState,
          futureSessions: plan.sessions.filter((s) => s.date >= now).length,
          pastEndDate: !!plan.finishingDate && plan.finishingDate < now,
          curriculumFiles: plan._count.curriculumFiles,
        })),
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
              quantity: z.number().min(1),
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
