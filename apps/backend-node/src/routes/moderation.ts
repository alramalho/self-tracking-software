import { Prisma } from "@tsw/prisma";
import { Response, Router } from "express";
import { z } from "zod/v4";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { sesService } from "../services/sesService";
import { TelegramService } from "../services/telegramService";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

// Reporting and blocking (App Store Guideline 1.2). The moderator acts on
// reports through the admin routes in admin.ts (GET /admin/reports).
const router = Router();
const telegramService = new TelegramService();

const ReportSchema = z.object({
  kind: z.enum([
    "USER",
    "MESSAGE",
    "COMMENT",
    "ACTIVITY_ENTRY",
    "ACHIEVEMENT_POST",
    "CIRCLE",
  ]),
  targetId: z.string().min(1).max(100),
  reason: z.enum(["SPAM", "HARASSMENT", "HATE", "SEXUAL", "SELF_HARM", "OTHER"]),
  note: z.string().trim().max(1000).optional(),
});
type ReportInput = z.infer<typeof ReportSchema>;

// Who owns the reported thing, plus a copy of what the reporter saw.
async function findReportTarget(
  kind: ReportInput["kind"],
  id: string
): Promise<{ userId: string; snapshot: Prisma.InputJsonObject } | null> {
  if (kind === "USER") {
    const user = await prisma.user.findUnique({ where: { id } });
    return user && { userId: user.id, snapshot: { username: user.username, name: user.name, picture: user.picture } };
  }
  if (kind === "MESSAGE") {
    const message = await prisma.message.findUnique({ where: { id } });
    return message?.senderId
      ? { userId: message.senderId, snapshot: { chatId: message.chatId, content: message.content } }
      : null;
  }
  if (kind === "COMMENT") {
    const comment = await prisma.comment.findUnique({ where: { id } });
    return comment && { userId: comment.userId, snapshot: { text: comment.text } };
  }
  if (kind === "ACTIVITY_ENTRY") {
    const entry = await prisma.activityEntry.findUnique({ where: { id } });
    return entry && {
      userId: entry.userId,
      snapshot: { description: entry.description, imageUrls: entry.imageUrls },
    };
  }
  if (kind === "ACHIEVEMENT_POST") {
    const post = await prisma.achievementPost.findUnique({
      where: { id },
      include: { images: true },
    });
    return post && {
      userId: post.userId,
      snapshot: { message: post.message, imageUrls: post.images.map((image) => image.url) },
    };
  }
  const circle = await prisma.practiceCircle.findUnique({
    where: { id },
    include: { members: { where: { owner: true }, take: 1 } },
  });
  return circle?.members[0]
    ? { userId: circle.members[0].userId, snapshot: { name: circle.name, topic: circle.topic } }
    : null;
}

// Report a person or a piece of their content. The owner is emailed and pinged on Telegram.
router.post(
  "/reports",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const parsed = ReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Choose what you are reporting and why" });
    }
    const input = parsed.data;
    const reporter = req.user!;
    try {
      const target = await findReportTarget(input.kind, input.targetId);
      if (!target) return res.status(404).json({ error: "Content not found" });
      if (target.userId === reporter.id) {
        return res.status(400).json({ error: "You can't report yourself" });
      }

      const report = await prisma.contentReport.create({
        data: {
          reporterId: reporter.id,
          targetUserId: target.userId,
          kind: input.kind,
          targetId: input.targetId,
          reason: input.reason,
          note: input.note || null,
          snapshot: target.snapshot,
        },
        include: { targetUser: { select: { username: true } } },
      });

      // Notifications must never fail the report itself.
      const summary = [
        `New ${input.kind} report: ${input.reason}`,
        `Reporter: @${reporter.username} (${reporter.id})`,
        `Reported user: @${report.targetUser.username} (${target.userId})`,
        `Note: ${input.note || "-"}`,
        `Content: ${JSON.stringify(target.snapshot, null, 2)}`,
        "",
        `Report id: ${report.id}`,
        "Open reports: GET https://api.tracking.so/admin/reports",
        `Remove content: POST https://api.tracking.so/admin/reports/${report.id}/resolve {"action":"remove"}`,
        `Remove and suspend the poster: POST https://api.tracking.so/admin/reports/${report.id}/resolve {"action":"suspend"}`,
        `Dismiss: POST https://api.tracking.so/admin/reports/${report.id}/resolve {"action":"dismiss"}`,
        "(Authorization: Bearer ADMIN_API_KEY). Please act within 24 hours.",
      ].join("\n");
      const escaped = summary
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      // REPORT_BCC_EMAILS (comma-separated) gets a copy so no report is missed.
      const bcc = (process.env.REPORT_BCC_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
      await sesService
        .sendEmail({
          to: [process.env.ADMIN_EMAIL || "alex@tracking.so"],
          bcc,
          subject: `🚩 ${input.kind} reported for ${input.reason}`,
          textBody: summary,
          htmlBody: `<pre style="white-space: pre-wrap">${escaped}</pre>`,
        })
        .catch((error) => logger.error("Failed to email content report:", error));
      // Code spans keep usernames/ids from breaking Telegram Markdown.
      await telegramService
        .sendAlert(
          `🚩 *New ${input.kind} report* (${input.reason})\n` +
            `Reported: \`@${report.targetUser.username}\` by \`@${reporter.username}\`\n` +
            `Report id: \`${report.id}\``
        )
        .catch((error) => logger.error("Failed to alert content report:", error));

      res.json({ id: report.id });
    } catch (error) {
      logger.error("Failed to create content report:", error);
      res.status(500).json({ error: "Failed to send report" });
    }
  }
);

// People I blocked (for Settings → Blocked people).
router.get(
  "/blocks",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const blocks = await prisma.userBlock.findMany({
        where: { blockerId: req.user!.id },
        orderBy: { createdAt: "desc" },
        include: {
          blocked: {
            select: { id: true, username: true, name: true, picture: true },
          },
        },
      });
      res.json({
        blocks: blocks.map((block) => ({
          ...block.blocked,
          blockedAt: block.createdAt,
        })),
      });
    } catch (error) {
      logger.error("Failed to list blocks:", error);
      res.status(500).json({ error: "Failed to load blocked people" });
    }
  }
);

// Block someone. Also removes any connection so they drop out of each other's feed.
router.post(
  "/blocks/:userId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    const blockerId = req.user!.id;
    const { userId: blockedId } = req.params;
    if (blockedId === blockerId) {
      return res.status(400).json({ error: "You can't block yourself" });
    }
    try {
      const blocked = await prisma.user.findUnique({ where: { id: blockedId } });
      if (!blocked) return res.status(404).json({ error: "User not found" });

      await prisma.$transaction([
        prisma.userBlock.upsert({
          where: { blockerId_blockedId: { blockerId, blockedId } },
          create: { blockerId, blockedId },
          update: {},
        }),
        prisma.connection.deleteMany({
          where: {
            OR: [
              { fromId: blockerId, toId: blockedId },
              { fromId: blockedId, toId: blockerId },
            ],
          },
        }),
      ]);
      res.json({ blocked: true });
    } catch (error) {
      logger.error("Failed to block user:", error);
      res.status(500).json({ error: "Failed to block user" });
    }
  }
);

router.delete(
  "/blocks/:userId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await prisma.userBlock.deleteMany({
        where: { blockerId: req.user!.id, blockedId: req.params.userId },
      });
      res.json({ blocked: false });
    } catch (error) {
      logger.error("Failed to unblock user:", error);
      res.status(500).json({ error: "Failed to unblock user" });
    }
  }
);

export const moderationRouter: Router = router;
