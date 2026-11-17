import type { Plan } from "@/core/types";
import type { PlanVisibilityChoice, VisibilityOption } from "./types";

export const visibilityOptions: VisibilityOption[] = [
  {
    value: "PUBLIC",
    label: "Everyone",
    description: "Your profile shows this plan and its logs.",
  },
  {
    value: "LOGS_ONLY",
    label: "Hide the plan",
    description: "Your logs still show, without the plan.",
  },
  {
    value: "PRIVATE",
    label: "Hide everything",
    description: "Only you see this plan and its logs.",
  },
];

export function visibilityLabel(value: Plan["visibility"]): string {
  if (value === "FRIENDS") return "Friends only";
  return (
    visibilityOptions.find((option) => option.value === (value ?? "PUBLIC"))
      ?.label ?? "Everyone"
  );
}

// An activity's logs stay hidden only when every plan holding it hides them,
// so "Hide everything" can't hide an activity that a visible plan also uses.
export function sharedLogNote(
  choice: Plan["visibility"],
  activityIds: string[],
  plans: Plan[],
  planId?: string,
): string | null {
  if (choice !== "PRIVATE") return null;
  for (const other of plans) {
    if (other.id === planId || other.deletedAt || other.visibility === "PRIVATE")
      continue;
    const shared = other.activities.find((a) => activityIds.includes(a.id));
    if (shared)
      return `${shared.emoji} ${shared.title} is also in ${other.emoji} ${other.goal}, so its logs still show.`;
  }
  return null;
}

export const isVisibilityChoice = (
  value: Plan["visibility"],
): value is PlanVisibilityChoice =>
  value === "PUBLIC" || value === "LOGS_ONLY" || value === "PRIVATE";
