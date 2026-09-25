import { TelegramService } from "@/services/telegramService";
import { clerkClient, clerkMiddleware, getAuth } from "@clerk/express";
import { User } from "@tsw/prisma";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { userService } from "../services/userService";
import { verifyWatchAccessToken } from "../services/auth/watchTokenService";
import { logger } from "../utils/logger";
import { setRequestContext } from "../utils/requestContext";

// Type for authenticated requests
export interface AuthenticatedRequest extends Request {
  user?: User; // marked as optional for express type handling, should work
}

async function tryWatchAuth(req: Request): Promise<User | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const claims = verifyWatchAccessToken(authHeader.substring(7));
    return await userService.getUserById(claims.sub);
  } catch (error) {
    return null;
  }
}

async function tryClerkAuth(req: Request): Promise<User | null> {
  const { userId: clerkUserId } = getAuth(req);
  if (!clerkUserId) return null;

  let user = await userService.getUserByClerkId(clerkUserId);
  if (user) return user;

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId
  )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    logger.warn(`Clerk user ${clerkUserId} has no email address`);
    return null;
  }

  user = await userService.getUserByClerkIdOrEmail(clerkUserId, primaryEmail);
  if (!user) {
    user = await userService.createUserFromClerk({
      clerkId: clerkUserId,
      email: primaryEmail,
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || undefined,
      picture: clerkUser.imageUrl,
    });
    const telegramService = new TelegramService();
    void telegramService.sendMessage(`🎉 New user! (${user.email})`);
  }

  return user;
}

// Middleware to verify authentication
async function verifyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = (await tryWatchAuth(req)) ?? (await tryClerkAuth(req));

    // If auth fails, return 401
    if (!user) {
      res.status(401).json({
        success: false,
        error: { message: "Authentication required" },
      });
      return;
    }

    // Suspended by a moderator (see POST /admin/users/:id/suspend).
    if (user.suspendedAt) {
      res.status(403).json({
        success: false,
        error: { message: "This account has been suspended.", code: "ACCOUNT_SUSPENDED" },
      });
      return;
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = user;

    // Set the user ID in the request context for AI service usage
    setRequestContext({ user: user });

    next();
  } catch (error) {
    logger.error("Failed to verify auth:", error);
    res.status(500).json({
      success: false,
      error: { message: "Authentication failed" },
    });
  }
}

// Export as array for compatibility with existing route definitions
export const requireAuth: RequestHandler[] = [
  clerkMiddleware() as RequestHandler,
  verifyAuth as RequestHandler,
];
