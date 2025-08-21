import { requireAuth as clerkRequireAuth, getAuth } from "@clerk/express";
import { User } from "@prisma/client";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { userService } from "../services/userService";
import { logger } from "../utils/logger";

// Type for authenticated requests
export interface AuthenticatedRequest extends Request {
  user?: User; // marked as optional for express type handling, should work
}

// Custom middleware to load user from database after Clerk auth
export function loadUserFromClerk(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { userId: clerkUserId } = getAuth(req);

  if (!clerkUserId) {
    res.status(401).json({
      success: false,
      error: { message: "Authentication required" },
    });
    return;
  }

  userService
    .getUserByClerkId(clerkUserId)
    .then((user) => {
      if (!user) {
        res.status(401).json({
          success: false,
          error: { message: "User not found" },
        });
        return;
      }
      (req as AuthenticatedRequest).user = user;
      next();
    })
    .catch((error) => {
      logger.error("Failed to load user:", error);
      res.status(500).json({
        success: false,
        error: { message: "Failed to load user" },
      });
    });
}

// Combined middleware: Clerk auth + user loading
export const requireAuth: RequestHandler[] = [
  clerkRequireAuth(),
  loadUserFromClerk,
];
