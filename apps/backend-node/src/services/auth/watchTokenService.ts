import jwt, { type JwtPayload } from "jsonwebtoken";
import type { WatchAuthClaims, WatchAuthTokens } from "./types";

const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "30d";

function getWatchAuthSecret(): string {
  const secret = process.env.WATCH_AUTH_SECRET;
  if (!secret) {
    throw new Error("WATCH_AUTH_SECRET is not configured");
  }
  return secret;
}

function signToken(userId: string, tokenUse: WatchAuthClaims["tokenUse"]): string {
  return jwt.sign({ tokenUse }, getWatchAuthSecret(), {
    subject: userId,
    issuer: "tracking.so",
    audience: "tracking.so-watch",
    expiresIn: tokenUse === "access" ? ACCESS_TOKEN_TTL : REFRESH_TOKEN_TTL,
  });
}

function verifyToken(token: string, expectedUse: WatchAuthClaims["tokenUse"]): WatchAuthClaims {
  const payload = jwt.verify(token, getWatchAuthSecret(), {
    issuer: "tracking.so",
    audience: "tracking.so-watch",
  }) as JwtPayload;

  if (!payload.sub || payload.tokenUse !== expectedUse) {
    throw new Error(`Invalid watch ${expectedUse} token`);
  }

  return { sub: payload.sub, tokenUse: expectedUse };
}

export function issueWatchAuthTokens(userId: string): WatchAuthTokens {
  return {
    accessToken: signToken(userId, "access"),
    refreshToken: signToken(userId, "refresh"),
  };
}

export function verifyWatchAccessToken(token: string): WatchAuthClaims {
  return verifyToken(token, "access");
}

export function verifyWatchRefreshToken(token: string): WatchAuthClaims {
  return verifyToken(token, "refresh");
}
