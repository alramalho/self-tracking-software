export interface $DbEnums {}


export namespace $DbEnums {
  type PlanType = "FREE" | "PLUS"
  type ThemeColor = "RANDOM" | "SLATE" | "BLUE" | "VIOLET" | "AMBER" | "EMERALD" | "ROSE"
  type ActivityVisibility = "PUBLIC" | "PRIVATE" | "FRIENDS"
  type DailyCheckinTime = "MORNING" | "AFTERNOON" | "EVENING"
  type PlanDurationType = "HABIT" | "LIFESTYLE" | "CUSTOM"
  type PlanOutlineType = "SPECIFIC" | "TIMES_PER_WEEK"
  type PlanState = "ON_TRACK" | "AT_RISK" | "FAILED" | "COMPLETED"
  type CriteriaJunction = "AND" | "OR"
  type ConnectionStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED"
  type InvitationStatus = "PENDING" | "ACCEPTED" | "REJECTED"
  type NotificationStatus = "PENDING" | "PROCESSED" | "OPENED" | "CONCLUDED"
  type NotificationType = "FRIEND_REQUEST" | "PLAN_INVITATION" | "ENGAGEMENT" | "INFO" | "METRIC_CHECKIN" | "COACH"
  type RecommendationObjectType = "USER"
  type MessageRole = "USER" | "ASSISTANT" | "SYSTEM"
}
