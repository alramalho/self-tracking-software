import { clerkClient } from "@clerk/express";
import appleSignin from "apple-signin-auth";
import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { OAuth2Client } from "google-auth-library";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import {
  issueWatchAuthTokens,
  verifyWatchRefreshToken,
} from "../services/auth/watchTokenService";
import { TelegramService } from "../services/telegramService";
import { userService } from "../services/userService";

const router: Router = createRouter();
const googleClient = new OAuth2Client(process.env.GOOGLE_IOS_CLIENT_ID);

interface NativeAuthProfile {
  email: string;
  name?: string;
  picture?: string;
}

async function createNativeSession(profile: NativeAuthProfile) {
  const clerkUsers = await clerkClient.users.getUserList({
    emailAddress: [profile.email],
    limit: 1,
  });

  let clerkUser = clerkUsers.data[0];
  if (!clerkUser) {
    const [firstName, ...lastNameParts] = profile.name?.trim().split(/\s+/) ?? [];
    clerkUser = await clerkClient.users.createUser({
      emailAddress: [profile.email],
      firstName: firstName || undefined,
      lastName: lastNameParts.join(" ") || undefined,
      skipPasswordRequirement: true,
    });
  }

  let databaseUser = await userService.getUserByClerkIdOrEmail(
    clerkUser.id,
    profile.email
  );

  if (!databaseUser) {
    databaseUser = await userService.createUserFromClerk({
      clerkId: clerkUser.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });
    const telegramService = new TelegramService();
    void telegramService.sendMessage(`🎉 New user! (${databaseUser.email})`);
  }

  const signInToken = await clerkClient.signInTokens.createSignInToken({
    userId: clerkUser.id,
    expiresInSeconds: 60,
  });

  return { ticket: signInToken.token, databaseUser };
}

router.post("/ios-google-signin", async (req: Request, res: Response) => {
  try {
    const { idToken, client } = req.body;
    if (!idToken) return res.status(400).json({ error: "idToken is required" });

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_IOS_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(400).json({ error: "Invalid token payload" });
    }

    const session = await createNativeSession({
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    });

    return res.json({
      ticket: session.ticket,
      ...(client === "watch" ? issueWatchAuthTokens(session.databaseUser.id) : {}),
    });
  } catch (error) {
    console.error("iOS Google sign-in error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
});

router.post("/ios-apple-signin", async (req: Request, res: Response) => {
  try {
    const { identityToken, user, client } = req.body;
    if (!identityToken) {
      return res.status(400).json({ error: "identityToken is required" });
    }

    const appleResponse = await appleSignin.verifyIdToken(identityToken, {
      audience: "so.tracking.app",
      ignoreExpiration: false,
    });
    if (!appleResponse.sub || !appleResponse.email) {
      return res.status(400).json({ error: "Invalid Apple token" });
    }

    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
    const session = await createNativeSession({
      email: appleResponse.email,
      name: fullName || undefined,
    });

    return res.json({
      ticket: session.ticket,
      ...(client === "watch" ? issueWatchAuthTokens(session.databaseUser.id) : {}),
    });
  } catch (error) {
    console.error("iOS Apple sign-in error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
});

router.post(
  "/watch-tokens",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    return res.json(issueWatchAuthTokens(req.user!.id));
  }
);

router.post("/watch-refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ error: "refreshToken is required" });
    }

    const claims = verifyWatchRefreshToken(refreshToken);
    const user = await userService.getUserById(claims.sub);
    if (!user || user.deletedAt) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    return res.json(issueWatchAuthTokens(user.id));
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

export default router;
