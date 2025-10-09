import recommendationsService from "@/services/recommendationsService";
import { Request, Response, Router } from "express";
import multer from "multer";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { linearService } from "../services/linearService";
import { notificationService } from "../services/notificationService";
import { s3Service } from "../services/s3Service";
import { sesService } from "../services/sesService";
import { TelegramService } from "../services/telegramService";
import { userService } from "../services/userService";
import {
  DailyCheckinSettingsSchema,
  FeedbackSchema,
  FriendRequestSchema,
  ThemeUpdateSchema,
  TimezoneUpdateSchema,
} from "../types/user";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

export const usersRouter: Router = Router();
const telegramService = new TelegramService();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const basicUserInclude = {
  connectionsFrom: {
    include: {
      to: {
        select: {
          id: true,
          username: true,
          name: true,
          picture: true,
        },
      },
    },
  },
  connectionsTo: {
    include: {
      from: {
        select: {
          id: true,
          username: true,
          name: true,
          picture: true,
        },
      },
    },
  },
} as const;

// Health check
usersRouter.get("/user-health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Get current user
usersRouter.get(
  "/user",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: basicUserInclude,
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json(user);
    } catch (error) {
      logger.error("Failed to fetch current user:", error);
      res.status(500).json({ error: "Failed to fetch current user" });
    }
  }
);

usersRouter.patch(
  "/user",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: req.user!.id },
        data: req.body,
        include: basicUserInclude,
      });

      res.json(updatedUser);
    } catch (error) {
      logger.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  }
);

// Load users data
// usersRouter.get(
//   "/load-users-data",
//   requireAuth,
//   async (req: AuthenticatedRequest, res: Response): Promise<void> => {
//     try {
//       const { usernames } = req.query;
//       const results: any = {};

//       // If no usernames provided, return current user data
//       if (!usernames) {
//         const userData = await userService.loadSingleUserData(
//           req.user!.id,
//           req.user!.id
//         );
//         return res.json({ current: userData });
//       }

//       // Otherwise load data for specified usernames
//       const usernamesList = (usernames as string).split(",");

//       for (const username of usernamesList) {
//         const user = await userService.getUserByUsername(
//           username.toLowerCase()
//         );
//         if (!user) continue;

//         const userData = await userService.loadSingleUserData(
//           user.id,
//           req.user!.id
//         );
//         results[username] = userData;
//       }

//       res.json(results);
//     } catch (error) {
//       logger.error("Failed to load multiple users data:", error);
//       res.status(500).json({
//         success: false,
//         error: { message: "Failed to load user data" },
//       });
//     }
//   }
// );

// Get user connections
usersRouter.get(
  "/connections/:username",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { username } = req.params;
      let user;

      if (username.toLowerCase() === req.user!.username?.toLowerCase()) {
        user = req.user!;
      } else {
        user = await userService.getUserByUsername(username.toLowerCase());
        if (!user) {
          res.status(404).json({
            success: false,
            error: { message: "User not found" },
          });
          return;
        }
      }

      const connections = await userService.getUserConnections(user.id);

      res.json({
        connections: connections.map((connection) => ({
          picture: connection.picture,
          username: connection.username,
          name: connection.name,
        })),
      });
    } catch (error) {
      logger.error("Failed to get user connections:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to get user connections" },
      });
    }
  }
);

// Check username availability
usersRouter.get(
  "/check-username/:username",
  async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      const user = await userService.getUserByUsername(username);
      res.json({ exists: user !== null });
    } catch (error) {
      logger.error("Failed to check username:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to check username" },
      });
    }
  }
);

// Update user
usersRouter.post(
  "/update-user",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userData = req.body;
      const updatedUser = await userService.updateUser(req.user!.id, userData);
      res.json({
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      logger.error("Failed to update user:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to update user" },
      });
    }
  }
);

// Update profile image
usersRouter.post(
  "/update-profile-image",
  requireAuth,
  upload.single("image"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { message: "No image file provided" },
        });
        return;
      }

      // Generate unique file key
      const fileExtension = req.file.mimetype.split("/")[1];
      const key = `profile-images/${req.user!.id}-${Date.now()}.${fileExtension}`;

      // Upload to S3 with public access
      await s3Service.upload(req.file.buffer, key, req.file.mimetype, true);

      // Get public URL
      const publicUrl = s3Service.getPublicUrl(key);

      // Update user's picture field
      const updatedUser = await userService.updateUser(req.user!.id, {
        picture: publicUrl,
      });

      res.json({
        message: "Profile image updated successfully",
        url: publicUrl,
        user: updatedUser,
      });
    } catch (error) {
      logger.error("Failed to update profile image:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to update profile image" },
      });
    }
  }
);

// Search users
usersRouter.get(
  "/search-users/:username",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { username } = req.params;

      if (req.user!.username?.toLowerCase() === username.toLowerCase()) {
        res.json([]);
        return;
      }

      let results = await userService.searchUsers(req.user!.id, username);

      if (results.length === 0) {
        // If no results, return all users (up to 5)
        const allUsers = await userService.getAllUsers();
        results = allUsers
          .filter((u) => u.id !== req.user!.id)
          .slice(0, 5)
          .map((u) => ({
            userId: u.id,
            username: u.username!,
            name: u.name,
            picture: u.picture,
          }));
      }

      res.json(results);
    } catch (error) {
      logger.error("Failed to search users:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to search users" },
      });
    }
  }
);

// Get connection count
usersRouter.get(
  "/user/connection-count",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const connectionCount = await userService.getConnectionCount(
        req.user!.id
      );
      res.json({ connectionCount });
    } catch (error) {
      logger.error("Failed to get connection count:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to get connection count" },
      });
    }
  }
);

// Get recommended users
usersRouter.get(
  "/recommended-users",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const recommendations = await recommendationsService.getRecommendedUsers(
        req.user!.id
      );
      res.json(recommendations);
    } catch (error) {
      logger.error("Failed to get recommended users:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to get recommended users" },
      });
    }
  }
);

// Fetch detailed user data by username or id
usersRouter.post(
  "/get-user",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { identifiers } = req.body as {
        identifiers?: Array<{ username?: string; id?: string }>;
      };

      if (!Array.isArray(identifiers) || identifiers.length === 0) {
        res.status(400).json({ error: "At least one identifier is required" });
        return;
      }

      const orConditions: Array<{ id: string } | { username: string }> =
        identifiers
          .map((identifier) => {
            if (identifier?.id) {
              return { id: identifier.id };
            }
            if (identifier?.username) {
              return { username: identifier.username.toLowerCase() };
            }
            return false;
          })
          .filter((condition) => condition !== false);

      if (!orConditions.length) {
        res
          .status(400)
          .json({ error: "Each identifier must include an id or username" });
        return;
      }

      const user = await prisma.user.findFirst({
        where: {
          deletedAt: null,
          OR: orConditions,
        },
        include: {
          ...basicUserInclude,
          plans: {
            where: {
              deletedAt: null,
              OR: [
                { finishingDate: { gt: new Date() } },
                { finishingDate: null },
              ],
            },
            include: {
              activities: {
                where: { deletedAt: null },
              },
            },
          },
          activities: {
            where: { deletedAt: null },
          },
          activityEntries: {
            where: { deletedAt: null },
            include: {
              activity: true,
              comments: {
                where: { deletedAt: null },
                orderBy: { createdAt: "asc" },
                include: {
                  user: {
                    select: { id: true, username: true, picture: true },
                  },
                },
              },
              reactions: {
                include: {
                  user: {
                    select: {
                      id: true,
                      username: true,
                      picture: true,
                      planType: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json(user);
    } catch (error) {
      logger.error("Failed to fetch user data:", error);
      res.status(500).json({ error: "Failed to fetch user data" });
    }
  }
);

// Get timeline data for user and connections
usersRouter.get(
  "/timeline",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: {
          plans: {
            where: {
              OR: [
                { finishingDate: { gt: new Date() } },
                { finishingDate: null },
              ],
            },
            include: {
              activities: { select: { id: true } },
            },
          },
          connectionsFrom: {
            include: {
              to: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  picture: true,
                  planType: true,
                  plans: {
                    where: {
                      OR: [
                        { finishingDate: { gt: new Date() } },
                        { finishingDate: null },
                      ],
                    },
                    include: {
                      activities: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
          connectionsTo: {
            include: {
              from: {
                select: {
                  id: true,
                  username: true,
                  name: true,
                  picture: true,
                  planType: true,
                  plans: {
                    where: {
                      OR: [
                        { finishingDate: { gt: new Date() } },
                        { finishingDate: null },
                      ],
                    },
                    include: {
                      activities: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        res.json({
          recommendedActivityEntries: [],
          recommendedActivities: [],
          recommendedUsers: [],
        });
        return;
      }

      const connections = [
        ...user.connectionsFrom
          .filter((conn) => conn.status === "ACCEPTED")
          .map((conn) => conn.to),
        ...user.connectionsTo
          .filter((conn) => conn.status === "ACCEPTED")
          .map((conn) => conn.from),
      ];

      if (!connections.length) {
        res.json({
          recommendedActivityEntries: [],
          recommendedActivities: [],
          recommendedUsers: [],
        });
        return;
      }

      const userIds = [user.id, ...connections.map((friend) => friend.id)];

      const activityEntries = await prisma.activityEntry.findMany({
        where: {
          userId: { in: userIds },
          deletedAt: null,
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 50,
        include: {
          activity: true,
          comments: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            include: {
              user: {
                select: { id: true, username: true, picture: true },
              },
            },
          },
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  picture: true,
                  planType: true,
                },
              },
            },
          },
        },
      });

      const activityIds = Array.from(
        new Set(activityEntries.map((entry) => entry.activityId))
      );
      const activities = await prisma.activity.findMany({
        where: { id: { in: activityIds } },
      });

      res.json({
        recommendedActivityEntries: activityEntries,
        recommendedActivities: activities,
        recommendedUsers: [user, ...connections],
      });
    } catch (error) {
      logger.error("Failed to fetch timeline data:", error);
      res.status(500).json({ error: "Failed to fetch timeline data" });
    }
  }
);

usersRouter.post(
  "/compute-recommendations",
  requireAuth,
  async (
    req: AuthenticatedRequest,
    res: Response
  ): Promise<Response | void> => {
    try {
      const { planId } = req.body;
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Update user embedding
      await userService.updateUserEmbedding(user);

      let plan;
      if (planId) {
        plan = await prisma.plan.findUnique({
          where: { id: planId },
        });
      }
      // Compute recommendations
      const recommendations =
        await recommendationsService.computeRecommendedUsers(user.id, plan);

      res.json({
        message: `Recommendations computed successfully for user ${req.user!.username}`,
        user_id: user.id,
        recommendations,
      });
    } catch (error) {
      logger.error("Error computing recommendations:", error);
      res.status(500).json({ error: "Failed to compute recommendations" });
    }
  }
);

// Get user profile
usersRouter.get(
  "/user/:username_or_id",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { username_or_id } = req.params;

      if (username_or_id.toLowerCase() === req.user!.username?.toLowerCase()) {
        res.json(req.user);
        return;
      }

      let user = await userService.getUserByUsername(username_or_id);

      if (!user) {
        user = await userService.getUserById(username_or_id);
      }

      if (!user) {
        res.status(404).json({
          success: false,
          error: { message: "User not found" },
        });
        return;
      }

      // Remove sensitive information
      const { email, clerkId, ...userProfile } = user;

      res.json(userProfile);
    } catch (error) {
      logger.error("Failed to get user profile:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to get user profile" },
      });
    }
  }
);

// usersRouter.get(
//   "/public/:username_or_id",
//   async (req: Request, res: Response) => {
//     try {
//       const { username_or_id } = req.params;

//       const user = await prisma.user.findFirst({
//         where: {
//           deletedAt: null,
//           OR: [
//             { username: username_or_id.toLowerCase() },
//             { id: username_or_id },
//           ],
//         },
//         include: createFullUserInclude(),
//       });

//       if (!user) {
//         return res.status(404).json({ error: "User not found" });
//       }

//       const { email, clerkId, ...publicUser } = user;
//       res.json(publicUser);
//     } catch (error) {
//       logger.error("Failed to fetch public user:", error);
//       res.status(500).json({ error: "Failed to fetch user" });
//     }
//   }
// );

// Send connection request
usersRouter.post(
  "/send-connection-request/:recipientId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { recipientId } = req.params;
      const body = FriendRequestSchema.parse(req.body);

      const connectionRequest = await userService.sendConnectionRequest(
        req.user!.id,
        recipientId,
        body.message
      );

      // Create notification for recipient
      const notification =
        await notificationService.createAndProcessNotification({
          userId: recipientId,
          message: `${req.user!.name} sent you a connection request${body.message ? ` with the message: ${body.message}` : ""}`,
          type: "FRIEND_REQUEST",
          relatedId: connectionRequest.id,
          relatedData: {
            id: req.user!.id,
            name: req.user!.name,
            username: req.user!.username,
            picture: req.user!.picture,
          },
        });

      res.json({
        message: "Connection request sent successfully",
        request: connectionRequest,
        notification,
      });
    } catch (error) {
      logger.error("Failed to send connection request:", error);
      res.status(400).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to send connection request",
        },
      });
    }
  }
);

// Accept connection request
usersRouter.post(
  "/accept-connection-request/:senderId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { senderId } = req.params;

      const connection = await userService.acceptConnectionRequest(
        senderId,
        req.user!.id
      );

      // Send notification to sender
      try {
        await notificationService.createAndProcessNotification({
          userId: senderId,
          message: `${req.user!.name} accepted your connection request. You can now see their activities!`,
          type: "INFO",
          relatedId: connection.id,
          relatedData: {
            id: req.user!.id,
            name: req.user!.name,
            username: req.user!.username,
            picture: req.user!.picture,
          },
        });
      } catch (notificationError) {
        logger.error("Failed to send notification:", notificationError);
      }

      res.json({
        message: "Connection request accepted",
        connection,
      });
    } catch (error) {
      logger.error("Failed to accept connection request:", error);
      res.status(400).json({
        success: false,
        error: { message: "Failed to accept connection request" },
      });
    }
  }
);

// Reject connection request
usersRouter.post(
  "/reject-connection-request/:senderId",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { senderId } = req.params;

      const connection = await userService.rejectConnectionRequest(
        senderId,
        req.user!.id
      );

      try {
        await notificationService.createAndProcessNotification({
          userId: senderId,
          message: `${req.user!.name} rejected your connection request.`,
          type: "INFO",
          relatedId: connection.id,
          relatedData: {
            id: req.user!.id,
            name: req.user!.name,
            username: req.user!.username,
            picture: req.user!.picture,
          },
        });
      } catch (notificationError) {
        logger.error("Failed to send notification:", notificationError);
      }

      res.json({
        message: "Connection request rejected",
        connection,
      });
    } catch (error) {
      logger.error("Failed to reject connection request:", error);
      res.status(400).json({
        success: false,
        error: { message: "Failed to reject connection request" },
      });
    }
  }
);

// Report feedback (supports both authenticated and unauthenticated users)
usersRouter.post(
  "/report-feedback",
  upload.array("images", 3), // Accept up to 3 images
  async (req: Request, res: Response) => {
    try {
      // Try to get authenticated user (optional)
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;

      const feedback = FeedbackSchema.parse(req.body);
      const files = req.files as Express.Multer.File[] | undefined;

      // Upload images to S3 if provided
      const imageUrls: string[] = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileExtension = file.mimetype.split("/")[1];
          const key = `feedback-images/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

          await s3Service.upload(file.buffer, key, file.mimetype, false);
          // Use public URL since bucket policy allows public read for feedback-images/*
          const publicUrl = s3Service.getPublicUrl(key);
          imageUrls.push(publicUrl);
        }
      }

      // Build email content
      const userInfo = user
        ? `${user.username} (${user.email})`
        : "Anonymous/Unauthenticated";
      const userId = user ? user.id : "N/A";

      // Send email notification using SES
      const adminEmail = process.env.ADMIN_EMAIL || "alex@tracking.so";

      const imagesHtml =
        imageUrls.length > 0
          ? `
<h3>Attached Images:</h3>
${imageUrls.map((url, index) => `<p><a href="${url}">Image ${index + 1}</a><br><img src="${url}" style="max-width: 600px; margin: 10px 0;" /></p>`).join("")}
`
          : "";

      try {
        await sesService.sendEmail({
          to: [adminEmail],
          subject: `New ${feedback.type} feedback${user ? ` from ${user.username}` : ""}`,
          textBody: `
Feedback received from: ${userInfo}
Type: ${feedback.type}
Contact Email: ${feedback.email}
Message: ${feedback.text}
${imageUrls.length > 0 ? `\nImages:\n${imageUrls.join("\n")}` : ""}

User ID: ${userId}
Timestamp: ${new Date().toISOString()}
          `,
          htmlBody: `
<h2>New ${feedback.type} Feedback</h2>
<p><strong>From:</strong> ${userInfo}</p>
<p><strong>Type:</strong> ${feedback.type}</p>
<p><strong>Contact Email:</strong> ${feedback.email}</p>
<p><strong>Message:</strong></p>
<blockquote>${feedback.text}</blockquote>
${imagesHtml}
<hr>
<p><small>User ID: ${userId}<br>
Timestamp: ${new Date().toISOString()}</small></p>
          `,
        });
        logger.info("Feedback email sent successfully");
      } catch (emailError) {
        logger.error("Failed to send feedback email:", emailError);
      }

      // Send Telegram notification for bug reports
      if (feedback.type === "bug_report") {
        const imageLinksText =
          imageUrls.length > 0
            ? `\n**Image Links:**\n${imageUrls.map((url, i) => `${i + 1}. ${url}`).join("\n")}\n`
            : "";

        const telegramMessage =
          `🐛 **New Bug Report**\n\n` +
          `**From:** ${userInfo}\n` +
          `**Contact:** ${feedback.email}\n` +
          `**Message:** ${feedback.text}${imageLinksText}` +
          `**UTC Time:** ${new Date().toISOString()}`;

        if (imageUrls.length > 0) {
          await telegramService.sendMessageWithPhotos(
            telegramMessage,
            imageUrls
          );
        } else {
          await telegramService.sendMessage(telegramMessage);
        }

        // Create Linear ticket for bug reports in production
        // if (process.env.NODE_ENV === "production") {
        try {
          const ticketUrl = await linearService.createBugTicket({
            title: `Bug: ${feedback.text.substring(0, 100)}${feedback.text.length > 100 ? "..." : ""}`,
            description: feedback.text,
            reporterEmail: feedback.email,
            reporterUsername: user?.username || undefined,
            imageUrls,
          });

          if (ticketUrl) {
            logger.info(`Linear ticket created for bug report: ${ticketUrl}`);
          }
        } catch (linearError) {
          logger.error("Failed to create Linear ticket:", linearError);
        }
        // }
      }

      logger.info("Feedback received:", {
        userId,
        username: user?.username || "anonymous",
        type: feedback.type,
        email: feedback.email,
        imageCount: imageUrls.length,
      });

      res.json({ status: "success" });
    } catch (error) {
      logger.error("Failed to send feedback:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to send feedback" },
      });
    }
  }
);

usersRouter.get(
  "/all-users",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await userService.getAllUsers();
      res.json({ usernames: users.map((user) => user.username) });
    } catch (error) {
      logger.error("Failed to get all users:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to get all users" },
      });
    }
  }
);

// Get user profile (public endpoint)
usersRouter.get(
  "/get-user-profile/:username_or_id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { username_or_id } = req.params;

      let user = await userService.getUserByUsername(username_or_id);
      if (!user) {
        user = await userService.getUserById(username_or_id);
        if (!user) {
          res.status(404).json({
            success: false,
            error: { message: `User '${username_or_id}' not found` },
          });
          return;
        }
      }

      // Fetch user plans and recent activities
      const [userPlans, userActivities] = await Promise.all([
        prisma.plan.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
          },
          include: {
            activities: {
              select: {
                id: true,
                title: true,
                emoji: true,
                measure: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        }),
        prisma.activity.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10, // Get latest 10 activities
        }),
      ]);

      // Transform plans to include activity details
      const transformedPlans = userPlans.map((plan) => ({
        id: plan.id,
        goal: plan.goal,
        emoji: plan.emoji,
        durationType: plan.durationType,
        finishingDate: plan.finishingDate,
        createdAt: plan.createdAt,
        activities: plan.activities,
      }));

      const userData = {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          picture: user.picture,
        },
        plans: transformedPlans,
        activities: userActivities.map((activity: any) => ({
          id: activity.id,
          title: activity.title,
          emoji: activity.emoji,
          measure: activity.measure,
          createdAt: activity.createdAt,
        })),
      };

      res.json(userData);
    } catch (error) {
      logger.error("Failed to fetch user profile:", error);
      res.status(500).json({
        success: false,
        error: { message: "Internal Server Error" },
      });
    }
  }
);

// Handle referral
usersRouter.post(
  "/handle-referral/:referrer_username",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { referrer_username } = req.params;

      await userService.handleReferral(referrer_username, req.user!.id);

      // Send notification to referrer
      const referrer = await userService.getUserByUsername(referrer_username);
      if (referrer) {
        await notificationService.createAndProcessNotification({
          userId: referrer.id,
          message: `${req.user!.name} joined tracking.so through your invite!`,
          type: "INFO",
          relatedId: req.user!.id,
          relatedData: {
            id: req.user!.id,
            name: req.user!.name,
            username: req.user!.username,
            picture: req.user!.picture,
          },
        });
      }

      res.json({ message: "Referral handled successfully" });
    } catch (error) {
      logger.error("Failed to handle referral:", error);
      res.status(400).json({
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : "Failed to handle referral",
        },
      });
    }
  }
);

// Load messages
usersRouter.get(
  "/load-messages",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { limit = 50, before } = req.query;

      // Build where clause for pagination
      const whereClause: any = {
        OR: [{ senderId: userId }, { recipientId: userId }],
      };

      // Add before cursor for pagination
      if (before && typeof before === "string") {
        whereClause.createdAt = {
          lt: new Date(before),
        };
      }

      // Fetch messages with pagination
      const messages = await prisma.message.findMany({
        where: whereClause,
        include: {
          user: true,
          emotions: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: parseInt(limit as string) || 50,
      });

      // Transform messages for frontend
      // const transformedMessages = messages.map((message) => ({
      //   id: message.id,
      //   text: message.text,
      //   createdAt: message.createdAt,
      //   sender: {
      //     id: message.sender.id,
      //     username: message.sender.username,
      //     name: message.sender.name,
      //     picture: message.sender.picture,
      //   },
      //   recipient: {
      //     id: message.recipient.id,
      //     username: message.recipient.username,
      //     name: message.recipient.name,
      //     picture: message.recipient.picture,
      //   },
      //   emotions: message.emotions,
      //   isSentByMe: message.senderId === userId,
      // }));

      res.json({
        messages,
        hasMore: messages.length === (parseInt(limit as string) || 50),
      });
    } catch (error) {
      logger.error("Failed to load messages:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to load messages" },
      });
    }
  }
);

// Update timezone
usersRouter.post(
  "/update-timezone",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { timezone } = TimezoneUpdateSchema.parse(req.body);

      // Validate timezone against common IANA timezone identifiers
      const validTimezones = [
        "UTC",
        "GMT",
        // Americas
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Toronto",
        "America/Vancouver",
        "America/Mexico_City",
        "America/Sao_Paulo",
        "America/Buenos_Aires",
        "America/Lima",
        "America/Bogota",
        "America/Caracas",
        // Europe
        "Europe/London",
        "Europe/Berlin",
        "Europe/Paris",
        "Europe/Rome",
        "Europe/Madrid",
        "Europe/Amsterdam",
        "Europe/Stockholm",
        "Europe/Vienna",
        "Europe/Zurich",
        "Europe/Prague",
        "Europe/Warsaw",
        "Europe/Budapest",
        "Europe/Athens",
        "Europe/Helsinki",
        "Europe/Oslo",
        "Europe/Copenhagen",
        "Europe/Brussels",
        "Europe/Lisbon",
        "Europe/Dublin",
        "Europe/Moscow",
        "Europe/Kiev",
        // Asia
        "Asia/Tokyo",
        "Asia/Shanghai",
        "Asia/Hong_Kong",
        "Asia/Singapore",
        "Asia/Seoul",
        "Asia/Jakarta",
        "Asia/Bangkok",
        "Asia/Manila",
        "Asia/Kuala_Lumpur",
        "Asia/Taipei",
        "Asia/Mumbai",
        "Asia/Kolkata",
        "Asia/Dubai",
        "Asia/Karachi",
        "Asia/Dhaka",
        "Asia/Istanbul",
        "Asia/Tehran",
        "Asia/Jerusalem",
        "Asia/Riyadh",
        "Asia/Baghdad",
        // Australia/Oceania
        "Australia/Sydney",
        "Australia/Melbourne",
        "Australia/Brisbane",
        "Australia/Perth",
        "Australia/Adelaide",
        "Pacific/Auckland",
        // Africa
        "Africa/Cairo",
        "Africa/Lagos",
        "Africa/Johannesburg",
        "Africa/Nairobi",
        "Africa/Casablanca",
        "Africa/Tunis",
        "Africa/Algiers",
      ];

      if (!validTimezones.includes(timezone)) {
        res.status(400).json({
          success: false,
          error: {
            message: `Invalid timezone. Must be a valid IANA timezone identifier.`,
          },
        });
        return;
      }

      const updatedUser = await userService.updateUser(req.user!.id, {
        timezone,
      });

      res.json({
        message: "Timezone updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      logger.error("Failed to update timezone:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to update timezone" },
      });
    }
  }
);

// Update theme
usersRouter.post(
  "/update-theme",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { theme_base_color } = ThemeUpdateSchema.parse(req.body);

      const updatedUser = await userService.updateUser(req.user!.id, {
        themeBaseColor: theme_base_color,
      });

      res.json({
        message: "Theme updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      logger.error("Failed to update theme:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to update theme" },
      });
    }
  }
);

// Get user plan type
usersRouter.get(
  "/user/:username/get-user-plan-type",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { username } = req.params;
      const user = await userService.getUserByUsername(username);

      if (!user) {
        res.status(404).json({
          success: false,
          error: { message: "User not found" },
        });
        return;
      }

      res.json({ plan_type: user.planType });
    } catch (error) {
      logger.error("Failed to get user plan type:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to get user plan type" },
      });
    }
  }
);

// Update daily checkin settings
usersRouter.post(
  "/user/daily-checkin-settings",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const settings = DailyCheckinSettingsSchema.parse(req.body);

      const updatedUser = await userService.updateUser(req.user!.id, {
        dailyCheckinDays: settings.days,
        dailyCheckinTime: settings.time || null,
      });

      res.json({
        message: "Daily checkin settings updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      logger.error("Failed to update daily checkin settings:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to update daily checkin settings" },
      });
    }
  }
);

export default usersRouter;
