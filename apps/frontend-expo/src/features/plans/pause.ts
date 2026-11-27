import type { Plan } from "@/core/types";

/** "paused until Mon 30 Nov" for a pause the coach set, else "paused". */
export function pausedLabel(plan: Pick<Plan, "pauseHistory">) {
  const until = plan.pauseHistory?.at(-1)?.until;
  if (!until) return "paused";
  const day = new Date(`${until}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `paused until ${day}`;
}
