import type { Person } from "@/core/types";

export type ReportKind =
  | "USER"
  | "MESSAGE"
  | "COMMENT"
  | "ACTIVITY_ENTRY"
  | "ACHIEVEMENT_POST"
  | "CIRCLE";
export type ReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "HATE"
  | "SEXUAL"
  | "SELF_HARM"
  | "OTHER";
export interface ReportTarget {
  kind: ReportKind;
  id: string;
  // Shown as "Why are you reporting {label}?", e.g. "this comment" or "@alex".
  label: string;
}
export interface ReportSheetProps {
  target?: ReportTarget;
  onClose: () => void;
}
export interface SafetyAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}
export interface BlockedPerson extends Person {
  blockedAt: string;
}
