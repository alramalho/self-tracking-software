import { TelegramService } from "@/services/telegramService";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { createClient } from "@supabase/supabase-js";
import { User } from "@tsw/prisma";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { userService } from "../services/userService";
import { logger } from "../utils/logger";
import { setRequestContext } from "../utils/requestContext";

// Type for authenticated requests
export interface AuthenticatedRequest extends Request {
  user?: User; // marked as optional for express type handling, should work
}

// Initialize Supabase client for JWT verification
const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:55321";
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey!);

// Middleware to verify Supabase JWT and load user from database
async function trySupabaseAuth(
  req: Request,
  res: Response
): Promise<User | null> {
  try {
    // Extract the Bearer token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null; // No Supabase token, will try Clerk
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token with Supabase
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      logger.warn("Invalid Supabase token:", error?.message);
      return null; // Invalid token, will try Clerk
    }

    // Load user from database - try supabaseAuthId first, fallback to email for migration
    let user = await userService.getUserBySupabaseAuthIdOrEmail(
      supabaseUser.id,
      supabaseUser.email!
    );

    // If user not found, auto-create them (social login flow)
    // This handles the case where Supabase has authenticated them but they don't exist in our DB yet
    if (!user) {
      logger.info(
        `Auto-creating user for social login: ${supabaseUser.email} (${supabaseUser.id})`
      );
      user = await userService.createUserFromSocialLogin({
        email: supabaseUser.email!,
        supabaseAuthId: supabaseUser.id,
        name: supabaseUser.user_metadata?.full_name,
        picture: supabaseUser.user_metadata?.avatar_url,
      });

      const telegramService = new TelegramService();
      telegramService.sendMessage(`🎉 New user! (${user.email})`);
    }

    return user;
  } catch (error) {
    logger.error("Failed to verify Supabase auth:", error);
    return null; // Error, will try Clerk
  }
}

// Middleware to load user from Clerk
async function tryClerkAuth(req: Request, res: Response): Promise<User | null> {
  try {
    const { userId: clerkUserId } = getAuth(req);

    if (!clerkUserId) {
      return null; // No Clerk user
    }

    const user = await userService.getUserByClerkId(clerkUserId);

    if (!user) {
      logger.warn(`Clerk user ${clerkUserId} not found in database`);
      return null;
    }

    return user;
  } catch (error) {
    logger.error("Failed to verify Clerk auth:", error);
    return null;
  }
}

// Combined middleware: Try Supabase first, fallback to Clerk
async function verifyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Try Supabase auth first (priority)
    let user = await trySupabaseAuth(req, res);

    // If Supabase fails, try Clerk
    if (!user) {
      user = await tryClerkAuth(req, res);
    }

    // If both auth methods fail, return 401
    if (!user) {
      res.status(401).json({
        success: false,
        error: { message: "Authentication required" },
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
// clerkMiddleware() is non-blocking and just adds auth context for getAuth() to work
export const requireAuth: RequestHandler[] = [
  clerkMiddleware() as unknown as RequestHandler,
  verifyAuth as RequestHandler,
];
