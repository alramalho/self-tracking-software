export type IosNotificationPreference = "enabled" | "disabled";

export type IosNotificationReconciliationResult =
  | "unavailable"
  | "not-requested"
  | "permission-denied"
  | "already-current"
  | "updated";

export interface IosNotificationRegistration {
  userId: string;
  serverEnabled: boolean;
  serverToken?: string | null;
}
