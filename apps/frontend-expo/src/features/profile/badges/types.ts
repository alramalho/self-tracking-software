import type { User } from "@/core/types";
export type BadgeKind = "streaks" | "habits" | "lifestyles";
export interface BadgeDetailsProps {
  user: User;
  kind: BadgeKind;
  onClose: () => void;
}
