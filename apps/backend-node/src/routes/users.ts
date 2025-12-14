import recommendationsService from "@/services/recommendationsService";
import { createClient } from "@supabase/supabase-js";
import { Request, Response, Router } from "express";
import multer from "multer";
import Stripe from "stripe";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { linearService } from "../services/linearService";
import { notificationService } from "../services/notificationService";
import { plansService } from "../services/plansService";
import { s3Service } from "../services/s3Service";
import { sesService } from "../services/sesService";
import { TelegramService } from "../services/telegramService";
import { userService } from "../services/userService";
import {
  DailyCheckinSettingsSchema,
  FeedbackSchema,
  FriendRequestSchema,
  TestimonialFeedbackSchema,
  ThemeUpdateSchema,
  TimezoneUpdateSchema,
} from "../types/user";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma";

export const usersRouter: Router = Router();
const telegramService = new TelegramService();

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
  apiVersion: "2025-07-30.basil",
});

// Initialize Supabase Admin client for user deletion
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
        include: {
          ...basicUserInclude,
          // Include coach profile if user is a human coach
          coaches: {
            where: {
              type: "HUMAN",
            },
            take: 1,
          },
        },
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Transform to include coachProfile field
      const { coaches, ...userData } = user;
      const userWithCoachProfile = {
        ...userData,
        coachProfile: coaches?.[0] || null,
      };

      res.json(userWithCoachProfile);
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
        include: {
          ...basicUserInclude,
          coaches: {
            where: {
              type: "HUMAN",
            },
            take: 1,
          },
        },
      });

      // Transform to include coachProfile field
      const { coaches, ...userData } = updatedUser;
      const userWithCoachProfile = {
        ...userData,
        coachProfile: coaches?.[0] || null,
      };

      res.json(userWithCoachProfile);
    } catch (error) {
      logger.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  }
);

// Delete user account (Apple Store compliant - effective deletion)
usersRouter.delete(
  "/user",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const supabaseAuthId = req.user!.supabaseAuthId;
      const stripeSubscriptionId = req.user!.stripeSubscriptionId;
      const userEmail = req.user!.email;
      const username = req.user!.username || "unknown";

      // Cancel Stripe subscription if exists
      let stripeCancellationStatus = "No active subscription";
      if (stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(stripeSubscriptionId);
          stripeCancellationStatus = "✅ Successfully cancelled";
          logger.info(
            `Canceled Stripe subscription ${stripeSubscriptionId} for user ${userId}`
          );
        } catch (stripeError) {
          stripeCancellationStatus = `❌ Failed: ${stripeError instanceof Error ? stripeError.message : "Unknown error"}`;
          logger.error("Failed to cancel Stripe subscription:", stripeError);
          // Continue with deletion even if Stripe cancellation fails
          // User can contact support if they're still being charged
        }
      }

      // Clean up many-to-many relationships that don't cascade automatically
      // Remove user from plan groups
      await prisma.user.update({
        where: { id: userId },
        data: {
          planGroupMemberships: {
            set: [], // Disconnect from all plan groups
          },
        },
      });

      // Handle self-referencing referral relationships
      // Remove this user as referrer for any referred users
      await prisma.user.updateMany({
        where: { referredById: userId },
        data: { referredById: null },
      });

      // Hard delete the user (CASCADE will delete all related records)
      await prisma.user.delete({
        where: { id: userId },
      });

      // Delete the Supabase Auth user (permanent deletion for Apple Store compliance)
      if (supabaseAuthId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(supabaseAuthId);
          logger.info(`Deleted Supabase Auth user: ${supabaseAuthId}`);
        } catch (authError) {
          logger.error("Failed to delete Supabase Auth user:", authError);
          // Continue even if auth deletion fails - user data is already deleted from DB
        }
      }

      // Send Telegram notification
      telegramService.sendMessage(
        `😵🗑️ *User Account Deleted*\n\n` +
          `User: ${username} (${userEmail})\n` +
          `User ID: ${userId}\n` +
          `Stripe Subscription: ${stripeCancellationStatus}\n` +
          `UTC Time: ${new Date().toISOString()}`
      );

      logger.info(`User account permanently deleted: ${userId}`);
      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      logger.error("Failed to delete user account:", error);
      res.status(500).json({ error: "Failed to delete account" });
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

      // Upload to S3 (public access controlled by bucket policy)
      await s3Service.upload(req.file.buffer, key, req.file.mimetype);

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

// Search users (only returns friends/connections)
usersRouter.get(
  "/search-users/:username?",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { username } = req.params;

      // Get user's accepted connections
      const connections = await userService.getUserConnections(req.user!.id);

      // If no connections, return empty array
      if (connections.length === 0) {
        res.json([]);
        return;
      }

      // Filter connections based on search query
      let results;
      if (!username || username.trim() === "") {
        // No search query - return all connections (up to 10)
        results = connections.slice(0, 10).map((u) => ({
          userId: u.id,
          username: u.username!,
          name: u.name,
          picture: u.picture,
        }));
      } else {
        // Search within connections only
        const searchTerm = username.toLowerCase();
        results = connections
          .filter(
            (u) =>
              u.username?.toLowerCase().includes(searchTerm) ||
              u.name?.toLowerCase().includes(searchTerm)
          )
          .slice(0, 10)
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
            where: {
              deletedAt: null,
              activityId: { not: null },
              activity: { deletedAt: null },
            },
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
          // Include coach profile if user is a human coach
          coaches: {
            where: {
              type: "HUMAN",
            },
            take: 1,
          },
        },
      });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // If viewing another user's profile, filter out private plans
      const isOwnProfile = user.id === req.user!.id;
      if (!isOwnProfile) {
        user.plans = user.plans.filter((plan) => plan.visibility !== "PRIVATE");
      }

      // Batch load progress for all user's plans
      const planIds = user.plans.map((p) => p.id);
      const plansProgress = await plansService.getBatchPlanProgress(
        planIds,
        req.user!.id,
        false // Use cache
      );

      // Create progress map for fast lookup
      const progressMap = new Map(plansProgress.map((p) => [p.plan.id, p]));

      // Augment each plan with progress data and add coach profile
      const userWithProgress = {
        ...user,
        plans: user.plans.map((plan) => ({
          ...plan,
          progress: progressMap.get(plan.id),
        })),
        // Extract the first (and only) human coach profile if exists
        coachProfile: user.coaches?.[0] || null,
      };

      // Remove the raw coaches array from response
      const { coaches, ...userResponse } = userWithProgress;

      res.json(userResponse);
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
            select: {
              id: true,
              visibility: true,
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
                    select: {
                      id: true,
                      visibility: true,
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
                    select: {
                      id: true,
                      visibility: true,
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
          achievementPosts: [],
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
          achievementPosts: [],
        });
        return;
      }

      const userIds = [user.id, ...connections.map((friend) => friend.id)];
      const allUsers = [user, ...connections];

      // Build sets of activity IDs in plans
      const activityIdsInPublicPlans = new Set<string>();
      const activityIdsInAnyPlan = new Set<string>();

      allUsers.forEach((u) => {
        u.plans?.forEach((plan: any) => {
          plan.activities?.forEach((activity: { id: string }) => {
            activityIdsInAnyPlan.add(activity.id);
            if (plan.visibility === "PUBLIC") {
              activityIdsInPublicPlans.add(activity.id);
            }
          });
        });
      });

      // Get all activities for these users
      const allActivities = await prisma.activity.findMany({
        where: {
          userId: { in: userIds },
          deletedAt: null,
        },
        select: { id: true },
      });

      // Determine which activity IDs to include:
      // - Activities in at least one PUBLIC plan, OR
      // - Activities not in any plan
      const validActivityIds = allActivities
        .filter((activity) => {
          if (activityIdsInPublicPlans.has(activity.id)) {
            // If activity is in at least one PUBLIC plan, include it
            return true;
          }
          // If activity is not in any plan, include it
          if (!activityIdsInAnyPlan.has(activity.id)) {
            return true;
          }
          // Otherwise, exclude (it's only in non-PUBLIC plans)
          return false;
        })
        .map((a) => a.id);

      // Fetch only activity entries for valid activities
      const filteredActivityEntries = await prisma.activityEntry.findMany({
        where: {
          userId: { in: userIds },
          activityId: { in: validActivityIds },
          deletedAt: null,
        },
        orderBy: [{ datetime: "desc" }, { createdAt: "desc" }],
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

      // Get public plan IDs for connected users
      const publicPlanIds = allUsers.flatMap(
        (u) =>
          u.plans?.filter((p) => p.visibility === "PUBLIC").map((p) => p.id) ||
          []
      );

      // Fetch achievement posts for users with PUBLIC plans OR level-up posts (no plan)
      const achievementPosts = await prisma.achievementPost.findMany({
        where: {
          userId: { in: userIds },
          deletedAt: null,
          OR: [
            { planId: { in: publicPlanIds } },
            { planId: null, achievementType: "LEVEL_UP" },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              picture: true,
            },
          },
          plan: {
            select: {
              id: true,
              goal: true,
              emoji: true,
              backgroundImageUrl: true,
            },
          },
          images: {
            orderBy: { sortOrder: "asc" },
          },
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
        new Set(
          filteredActivityEntries
            .map((entry) => entry.activityId)
            .filter((id): id is string => id !== null)
        )
      );
      const activities = await prisma.activity.findMany({
        where: { id: { in: activityIds } },
      });

      // Collect all plan IDs from all users
      const allPlanIds = allUsers.flatMap(
        (u) => u.plans?.map((p) => p.id) || []
      );

      // Batch load progress for all plans
      const plansProgress = await plansService.getBatchPlanProgress(
        allPlanIds,
        req.user!.id,
        false // Use cache
      );

      // Create progress map for fast lookup
      const progressMap = new Map(plansProgress.map((p) => [p.plan.id, p]));

      // Augment each user's plans with progress data
      const usersWithProgress = allUsers.map((u) => ({
        ...u,
        plans: u.plans?.map((plan) => ({
          ...plan,
          progress: progressMap.get(plan.id),
        })),
      }));

      res.json({
        recommendedActivityEntries: filteredActivityEntries,
        recommendedActivities: activities,
        recommendedUsers: usersWithProgress,
        achievementPosts: achievementPosts,
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
      let user: any = authReq.user;

      if (!user) {
        user = await prisma.user.findFirst({
          where: {
            email: req.body.email,
          },
        });
      }

      const feedback = FeedbackSchema.parse(req.body);
      const files = req.files as Express.Multer.File[] | undefined;

      // Upload images to S3 if provided
      const imageUrls: string[] = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileExtension = file.mimetype.split("/")[1];
          const key = `feedback-images/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

          await s3Service.upload(file.buffer, key, file.mimetype);
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

      // Store feedback in database
      if (user) {
        const feedbackCategory =
          feedback.type === "bug_report"
            ? "BUG"
            : feedback.type === "feature_request"
              ? "FEATURE_REQUEST"
              : "QUESTION";

        await prisma.feedback.create({
          data: {
            userId: user.id,
            category: feedbackCategory,
            content: feedback.text,
            imageUrls: imageUrls,
            metadata: {
              email: feedback.email,
              type: feedback.type,
              timestamp: new Date().toISOString(),
            },
          },
        });
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

// Submit testimonial feedback
usersRouter.post(
  "/submit-testimonial-feedback",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: { message: "User not authenticated" },
        });
        return;
      }

      const feedback = TestimonialFeedbackSchema.parse(req.body);

      const sentimentEmojis = ["😭", "😞", "🙂", "🤩"];
      const sentimentLabels = [
        "Very unhappy",
        "Unhappy",
        "Happy",
        "Very happy",
      ];

      // Send email notification to admin
      const adminEmail = process.env.ADMIN_EMAIL!;
      const sentimentEmoji = sentimentEmojis[feedback.sentiment - 1];
      const sentimentLabel = sentimentLabels[feedback.sentiment - 1];

      const rewriteNote = feedback.wasRewritten
        ? "\n(AI-rewritten)"
        : "\n(Original)";

      try {
        await sesService.sendEmail({
          to: [adminEmail],
          subject: `New Testimonial Feedback from ${user.username}`,
          textBody: `
Testimonial feedback received from: ${user.name} (@${user.username})
Email: ${user.email}

Sentiment: ${sentimentEmoji} ${sentimentLabel}

TESTIMONIAL MESSAGE:${rewriteNote}
"${feedback.message}"

User ID: ${user.id}
Activity Count: Check in dashboard
Timestamp: ${new Date().toISOString()}
          `,
          htmlBody: `
<h2>New Testimonial Feedback</h2>
<p><strong>From:</strong> ${user.name} (@${user.username})</p>
<p><strong>Email:</strong> ${user.email}</p>

<h3>Sentiment: ${sentimentEmoji} ${sentimentLabel}</h3>

<div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0; font-style: italic;">"${feedback.message}"</p>
  <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">${feedback.wasRewritten ? "✨ AI-rewritten" : "📝 Original"}</p>
</div>

<hr>
<p><small>User ID: ${user.id}<br>
Timestamp: ${new Date().toISOString()}</small></p>
          `,
        });
        logger.info("Testimonial feedback email sent successfully");
      } catch (emailError) {
        logger.error("Failed to send testimonial feedback email:", emailError);
      }

      // Send Telegram notification
      const telegramRewriteFlag = feedback.wasRewritten
        ? " ✨ (AI-rewritten)"
        : " 📝 (Original message)";
      const telegramMessage =
        `✨ **New Testimonial Feedback**\n\n` +
        `**From:** ${user.name} (@${user.username})\n` +
        `**Sentiment:** ${sentimentEmoji} ${sentimentLabel}\n\n` +
        `**Testimonial:**${telegramRewriteFlag}\n"${feedback.message}"\n\n` +
        `**UTC Time:** ${new Date().toISOString()}`;

      try {
        await telegramService.sendMessage(telegramMessage);
        logger.info("Testimonial feedback Telegram notification sent");
      } catch (telegramError) {
        logger.error(
          "Failed to send testimonial feedback Telegram notification:",
          telegramError
        );
      }

      // Store testimonial feedback in database
      await prisma.feedback.create({
        data: {
          userId: user.id,
          category: "TESTIMONIAL",
          content: feedback.message,
          metadata: {
            sentiment: feedback.sentiment,
            sentimentLabel: sentimentLabel,
            wasRewritten: feedback.wasRewritten,
            timestamp: new Date().toISOString(),
          },
        },
      });

      logger.info("Testimonial feedback received:", {
        userId: user.id,
        username: user.username,
        sentiment: feedback.sentiment,
        message: feedback.message,
        wasRewritten: feedback.wasRewritten,
      });

      res.json({ status: "success" });
    } catch (error) {
      logger.error("Failed to submit testimonial feedback:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to submit testimonial feedback" },
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
