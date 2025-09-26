import { Prisma, User } from "@tsw/prisma";
import { HydratedCurrentUser } from "./service";

export type ThemeColorType =
  | "blue"
  | "violet"
  | "emerald"
  | "rose"
  | "amber"
  | "slate"
  | "random";

export interface UsersContextType {
  // Current user data
  currentUser: HydratedCurrentUser | undefined;
  isLoadingCurrentUser: boolean;
  currentUserError: Error | null;

  // Data management
  refetchCurrentUser: (notify?: boolean) => Promise<void>;
  hasLoadedUserData: boolean;

  // Auth helpers
  handleAuthError: (err: unknown) => void;
  // Actions
  updateUser: (data: {
    updates: Prisma.UserUpdateInput;
    muteNotifications?: boolean;
  }) => Promise<User>;
  isUpdatingUser: boolean;

  sendFriendRequest: (userId: string) => Promise<void>;
  isSendingFriendRequest: boolean;

  acceptFriendRequest: (user: { id: string, username: string }) => Promise<void>;
  isAcceptingFriendRequest: boolean;

  rejectFriendRequest: (user: { id: string, username: string }) => Promise<void>;
  isRejectingFriendRequest: boolean;
}