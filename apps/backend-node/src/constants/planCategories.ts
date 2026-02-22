export const PLAN_CATEGORIES = [
  // Fitness & Sports
  { key: "running", label: "Running", emoji: "🏃" },
  { key: "cycling", label: "Cycling", emoji: "🚴" },
  { key: "swimming", label: "Swimming", emoji: "🏊" },
  { key: "strength_training", label: "Strength Training", emoji: "🏋️" },
  { key: "yoga", label: "Yoga", emoji: "🧘" },
  { key: "martial_arts", label: "Martial Arts", emoji: "🥋" },
  { key: "team_sports", label: "Team Sports", emoji: "⚽" },
  { key: "outdoor_adventure", label: "Outdoor Adventure", emoji: "🏔️" },
  { key: "dance", label: "Dance", emoji: "💃" },
  { key: "flexibility_mobility", label: "Flexibility & Mobility", emoji: "🤸" },

  // Health & Wellness
  { key: "nutrition", label: "Nutrition", emoji: "🥗" },
  { key: "weight_management", label: "Weight Management", emoji: "⚖️" },
  { key: "sleep", label: "Sleep", emoji: "😴" },
  { key: "mental_health", label: "Mental Health", emoji: "🧠" },
  { key: "meditation", label: "Meditation", emoji: "🧘‍♂️" },

  // Learning & Skills
  { key: "reading", label: "Reading", emoji: "📚" },
  { key: "language_learning", label: "Language Learning", emoji: "🗣️" },
  { key: "music", label: "Music", emoji: "🎵" },
  { key: "writing", label: "Writing", emoji: "✍️" },
  { key: "coding", label: "Coding", emoji: "💻" },
  { key: "art", label: "Art", emoji: "🎨" },

  // Lifestyle & Productivity
  { key: "productivity", label: "Productivity", emoji: "📋" },
  { key: "finance", label: "Finance", emoji: "💰" },
  { key: "social", label: "Social", emoji: "🤝" },
  { key: "career", label: "Career", emoji: "💼" },
  { key: "habit_building", label: "Habit Building", emoji: "🔄" },
  { key: "self_care", label: "Self Care", emoji: "🌿" },
  { key: "home", label: "Home", emoji: "🏠" },

  // Fallback
  { key: "other", label: "Other", emoji: "📌" },
] as const;

export type PlanCategoryKey = (typeof PLAN_CATEGORIES)[number]["key"];

export const PLAN_CATEGORY_KEYS = PLAN_CATEGORIES.map((c) => c.key);
