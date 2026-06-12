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

function buildMcpServer(user: User): McpServer {
  const server = new McpServer({
    name: "tracking-so",
    version: "1.0.0",
  });

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
