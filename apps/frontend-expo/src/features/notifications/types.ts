import type { AppNotification } from "@/features/social/types";

/** The person a notification is about: who reacted, commented, posted or wrote. */
export interface NotificationActor {
  name: string;
  picture?: string;
}

/** A notification's line, split so the screen can bold the @handle and lift the closing emoji onto the avatar. */
export interface NotificationText {
  handle?: string;
  rest: string;
  emoji?: string;
}

/** The list as the screen shows it: what arrived since the last visit, then the rest. */
export interface NotificationSections<T> {
  fresh: T[];
  earlier: T[];
}

export interface NotificationRowProps {
  notification: AppNotification;
}

export interface NotificationAvatarProps extends NotificationRowProps {
  emoji?: string;
}
