import type { ActivityEntry } from "@tsw/prisma";

export type PhotoActor = {
  id: string;
  username: string | null;
  name: string | null;
  picture: string | null;
  timezone: string | null;
};

export type PhotoActivity = {
  id: string;
  title: string;
  emoji: string;
  measure: string;
  deletedAt: Date | null;
};

export type PhotoNotificationEligibility = {
  completedAt: Date;
  timezone: string | null | undefined;
  now: Date;
};

export type ActivityPhotoNotificationRequest = {
  user: PhotoActor;
  activity: PhotoActivity;
  entry: ActivityEntry;
  photoAddedAt?: Date;
  now?: Date;
};
