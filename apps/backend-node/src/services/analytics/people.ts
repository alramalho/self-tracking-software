import type { Prisma } from "@tsw/prisma";

/** Owner test accounts and fixtures: left out of analytics and onboarding alerts. */
export const realPeople: Prisma.UserWhereInput = {
  deletedAt: null,
  AND: [
    { email: { not: { startsWith: "alexandre.ramalho.1998+" } } },
    { email: { not: { endsWith: "@test.com" } } },
    { email: { not: "alex@chatarmin.com" } },
    { email: { not: { startsWith: "lia.borges+" } } },
  ],
};

/** Who may open tracking.so/analytics: ANALYTICS_EMAILS (comma-separated) on the server. */
export function canSeeAnalytics(email: string | null | undefined, env = process.env) {
  const allowed = (env.ANALYTICS_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return !!email && allowed.includes(email.trim().toLowerCase());
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const dayKey = (date: Date) => date.toISOString().slice(0, 10);
