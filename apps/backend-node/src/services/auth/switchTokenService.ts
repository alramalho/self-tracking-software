import crypto from "crypto";
import type { User } from "@tsw/prisma";
import { prisma } from "@/utils/prisma";

// A device that has not switched to an account for this long must sign in again.
const UNUSED_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

function hashSwitchToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Lets a device sign back into this account later. The plaintext token is returned exactly once. */
export async function issueSwitchToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.accountSwitchToken.create({
    data: { userId, tokenHash: hashSwitchToken(token) },
  });
  return token;
}

/** The account a switch token signs into, or null once it is revoked, expired or the account is gone. */
export async function redeemSwitchToken(token: string): Promise<User | null> {
  const stored = await prisma.accountSwitchToken.findUnique({
    where: { tokenHash: hashSwitchToken(token) },
    include: { user: true },
  });
  if (!stored || stored.user.deletedAt) return null;

  if (Date.now() - stored.lastUsedAt.getTime() > UNUSED_TOKEN_LIFETIME_MS) {
    await prisma.accountSwitchToken.delete({ where: { id: stored.id } });
    return null;
  }

  await prisma.accountSwitchToken.update({
    where: { id: stored.id },
    data: { lastUsedAt: new Date() },
  });
  return stored.user;
}

/** Forgets a device's switch token, e.g. when the account logs out there. */
export async function revokeSwitchToken(token: string): Promise<void> {
  await prisma.accountSwitchToken.deleteMany({
    where: { tokenHash: hashSwitchToken(token) },
  });
}
