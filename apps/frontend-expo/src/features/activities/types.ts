import type { Activity } from "@/core/types";
export interface LoggerProps {
  activity: Activity;
  initialDate?: Date;
  initialQuantity?: number;
  onLogged?: (entry: import("@/core/types").ActivityEntry) => void;
  onClose: () => void;
}
export type LogStep =
  | "quantity"
  | "photos"
  | "shared"
  | "difficulty"
  | "metrics"
  | "queued"
  | "done";
export interface FriendResult {
  userId: string;
  username: string;
  name?: string | null;
  picture?: string | null;
}
export interface FriendPickerProps {
  value?: FriendResult;
  onChange: (friend: FriendResult | undefined) => void;
}
