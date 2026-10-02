import type { ReactNode } from "react";
import type { Message } from "../types";

export interface EntityReference {
  kind: "plan" | "activity" | "metric";
  id: string;
  label: string;
  emoji?: string | null;
}
export interface Replacement {
  start: number;
  end: number;
  reference: EntityReference;
}
export interface PreviewProps {
  reference?: EntityReference;
  message?: Message;
  onClose: () => void;
}
export interface PreviewSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}
export interface PreviewButtonProps {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}
export interface ProposalReviewProps {
  onViewAccepted?: () => void;
  label: string;
  title: string;
  emoji?: string | null;
  description?: string;
  summary?: ReactNode;
  status?: string | null;
  children: ReactNode;
  quickActions?: ReactNode;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}
