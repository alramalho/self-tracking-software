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

export interface ReportReasonOption {
  value: ReportReason;
  label: string;
}

export interface ReportTarget {
  kind: ReportKind;
  id: string;
  // Shown as "Why are you reporting {label}?", e.g. "this circle" or "@alex".
  label: string;
}

export interface ReportDialogProps {
  target?: ReportTarget;
  onClose: () => void;
}

export interface SafetyAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

export interface ActionSheetContent {
  title?: string;
  actions: SafetyAction[];
}

export interface ActionSheetProps extends ActionSheetContent {
  open: boolean;
  onClose: () => void;
}

export interface BlockablePerson {
  id: string;
  name?: string | null;
  username?: string | null;
}
