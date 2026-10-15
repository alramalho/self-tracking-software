import type { PlanConfidence } from "@tsw/prisma/follow-through";

/**
 * The plan's confidence line for the coach's context. The person rated how sure they were of this
 * exact plan and said, in their own words, why it wasn't lower. When they slip, those words are the
 * strongest reminder the coach has, so it gets them verbatim.
 */
export function describeConfidence(value: unknown): string {
  const confidence = value as PlanConfidence | null | undefined;
  if (!confidence || typeof confidence.score !== "number") return "";
  const asked = String(confidence.askedAt ?? "").slice(0, 10);
  const why = confidence.why?.trim();
  return [
    `Confidence when they set it up${asked ? ` (${asked})` : ""}: ${confidence.score}/10.`,
    why ? `Asked "${confidence.question}", they said: "${why}". When they slip, remind them of this in their own words, once, without lecturing.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
