// What a signed-in person may change on their own user row through PATCH /users/user.
// Identity, billing and bookkeeping fields are set by the server only, and relation
// fields are never accepted (a nested write could connect to someone else's records).

const PROTECTED_FIELDS = new Set([
  "id",
  "clerkId",
  "email",
  "planType",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "stripeSubscriptionStatus",
  "referredById",
  "createdAt",
  "deletedAt",
  "suspendedAt",
  "lastActiveAt",
  "unactivatedEmailSentAt",
  "onboardingDropNotifiedAt",
  // AI consent changes only through PUT /users/ai-consent.
  "aiConsentGrantedAt",
  "aiConsentDeclinedAt",
]);

// The only fields whose values are legitimately arrays or objects.
const ARRAY_FIELDS = new Set(["reactionEmojis"]);
const JSON_FIELDS = new Set(["onboardingProgress"]);

export function userSelfUpdate(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (PROTECTED_FIELDS.has(key)) continue;
    if (Array.isArray(value) && !ARRAY_FIELDS.has(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value) && !JSON_FIELDS.has(key)) continue;
    updates[key] = value;
  }
  return updates;
}
