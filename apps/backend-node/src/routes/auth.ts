import { clerkClient } from "@clerk/express";
import appleSignin from "apple-signin-auth";
import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { OAuth2Client } from "google-auth-library";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import {
  issueSwitchToken,
  redeemSwitchToken,
  revokeSwitchToken,
} from "../services/auth/switchTokenService";
import {
  issueWatchAuthTokens,
  verifyWatchRefreshToken,
} from "../services/auth/watchTokenService";
import { TelegramService } from "../services/telegramService";
import { userService } from "../services/userService";

const router: Router = createRouter();
const googleClient = new OAuth2Client(process.env.GOOGLE_IOS_CLIENT_ID);
const appleAppAudiences = ["so.tracking.app", "so.tracking.app.watchkitapp"];

interface NativeAuthProfile {
  email: string;
  name?: string;
  picture?: string;
}

/** A one-minute ticket the app exchanges with Clerk for a session. */
async function createSignInTicket(clerkUserId: string) {
  const signInToken = await clerkClient.signInTokens.createSignInToken({
    userId: clerkUserId,
    expiresInSeconds: 60,
  });
  return signInToken.token;
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

  return { ticket: await createSignInTicket(clerkUser.id), databaseUser };
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
      audience: appleAppAudiences,
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

// Remembers the signed-in account on this device so it can be switched back to.
router.post(
  "/switch-tokens",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      return res.json({ switchToken: await issueSwitchToken(req.user!.id) });
    } catch (error) {
      console.error("Switch token issue error:", error);
      return res.status(500).json({ error: "Could not remember this account" });
    }
  }
);

// Logging an account out of a device forgets it there.
router.post("/switch-tokens/revoke", async (req: Request, res: Response) => {
  try {
    const switchToken = req.body?.switchToken;
    if (typeof switchToken !== "string") {
      return res.status(400).json({ error: "switchToken is required" });
    }
    await revokeSwitchToken(switchToken);
    return res.json({ revoked: true });
  } catch (error) {
    console.error("Switch token revoke error:", error);
    return res.status(500).json({ error: "Could not forget this account" });
  }
});

// Switching accounts: the device proves it remembers the account and gets a sign-in ticket.
router.post("/switch", async (req: Request, res: Response) => {
  try {
    const switchToken = req.body?.switchToken;
    if (typeof switchToken !== "string") {
      return res.status(400).json({ error: "switchToken is required" });
    }

    const user = await redeemSwitchToken(switchToken);
    if (!user?.clerkId) {
      return res.status(401).json({ error: "Sign in to this account again" });
    }

    return res.json({ ticket: await createSignInTicket(user.clerkId) });
  } catch (error) {
    console.error("Account switch error:", error);
    return res.status(500).json({ error: "Could not switch accounts" });
  }
});

export default router;
