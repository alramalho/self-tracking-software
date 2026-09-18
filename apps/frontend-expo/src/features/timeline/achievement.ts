import type { Achievement } from "@/core/types";

export function achievementTitle(post: Achievement) {
  switch (post.achievementType) {
    case "STREAK":
      return `🔥 ${post.streakNumber ?? 0} Week Streak!`;
    case "HABIT":
      return "⭐ Habit Formed!";
    case "LIFESTYLE":
      return "🏆 Lifestyle Achievement!";
    case "LEVEL_UP":
      return `🎖️ Reached ${post.levelName}!`;
    default:
      return `🏅 ${post.title ?? post.plan?.goal ?? "Achievement"}`;
  }
}
