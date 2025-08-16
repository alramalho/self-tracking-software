import { UpdateValue, UpsertValue, Zero } from "@rocicorp/zero";
import {
  Schema,
  ConnectionStatus,
  ActivityVisibility,
  User,
  Activity,
  ActivityEntry,
  Plan,
  Notification,
  Metric,
  MetricEntry,
  Message,
  MessageEmotion,
  schema,
} from "./schema";
import { Mutators } from "./mutators";

// Common date fields that need conversion from number to Date
const DEFAULT_DATE_FIELDS = [
  "createdAt",
  "updatedAt",
  "deletedAt",
  "sentAt",
  "processedAt",
  "openedAt",
  "concludedAt",
  "scheduledFor",
  "lastActiveAt",
  "unactivatedEmailSentAt",
  "recommendationsLastCalculatedAt",
  "finishingDate",
  "suggestedByCoachAt",
  "currentWeekStateCalculatedAt",
  "date",
  "imageExpiresAt",
  "imageCreatedAt",
] as const;

type DefaultDateField = (typeof DEFAULT_DATE_FIELDS)[number];

// Type to convert number date fields to Date objects
type ConvertDates<T, Fields extends string = DefaultDateField> = T extends any[]
  ? ConvertDates<T[number], Fields>[]
  : T extends object
  ? {
      [K in keyof T]: K extends Fields
        ? T[K] extends number | null | undefined
          ? number extends T[K]
            ? Date | Exclude<T[K], number>
            : T[K]
          : T[K]
        : T[K] extends object
        ? ConvertDates<T[K], Fields>
        : T[K];
    }
  : T;

// Helper function to convert number timestamps to Date objects
function convertNumberToDates<T, Fields extends string = DefaultDateField>(
  data: T,
  dateFields: Fields[] = [...DEFAULT_DATE_FIELDS] as Fields[]
): ConvertDates<T, Fields> {
  if (!data) return data as ConvertDates<T, Fields>;

  if (Array.isArray(data)) {
    return data.map((item) =>
      convertNumberToDates(item, dateFields)
    ) as ConvertDates<T, Fields>;
  }

  if (typeof data === "object" && data !== null) {
    const result = { ...data } as any;

    for (const [key, value] of Object.entries(result)) {
      if ((dateFields as string[]).includes(key) && typeof value === "number") {
        result[key] = new Date(value);
      } else if (typeof value === "object" && value !== null) {
        result[key] = convertNumberToDates(value, dateFields);
      }
    }

    return result as ConvertDates<T, Fields>;
  }

  return data as ConvertDates<T, Fields>;
}

export type HydratedCurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;
export type HydratedUser = Awaited<ReturnType<typeof getOtherUser>>;
export type TimelineData = Awaited<ReturnType<typeof getTimeline>>;

export type MessagesWithRelations = Message & {
  emotions: MessageEmotion[];
};
export async function getTimeline(
  z: Zero<Schema, Mutators>,
  args: { userId: string }
) {
  const user = await z.query.users.where("id", args.userId).one();
  if (!user) {
    return convertNumberToDates({
      recommendedActivityEntries: [],
      recommendedActivities: [],
      recommendedUsers: [],
    });
  }

  const connectionsFrom = await z.query.connections
    .where("fromId", args.userId)
    .where("status", ConnectionStatus.ACCEPTED);
  const connectionsTo = await z.query.connections
    .where("toId", args.userId)
    .where("status", ConnectionStatus.ACCEPTED);

  const connectedUserIds = [
    ...connectionsFrom.map((conn) => conn.toId),
    ...connectionsTo.map((conn) => conn.fromId),
  ];

  if (connectedUserIds.length === 0) {
    return convertNumberToDates({
      recommendedActivityEntries: [],
      recommendedActivities: [],
      recommendedUsers: [],
    });
  }

  const userIds = [args.userId, ...connectedUserIds];

  const activityEntries = await z.query.activity_entries
    .where("deletedAt", "IS", null)
    .orderBy("createdAt", "desc")
    .limit(50);

  const filteredEntries = activityEntries.filter((entry) =>
    userIds.includes(entry.userId)
  );

  const activityIds = Array.from(
    new Set(filteredEntries.map((entry) => entry.activityId))
  );

  const activities = await z.query.activities;
  const filteredActivities = activities.filter((activity) =>
    activityIds.includes(activity.id)
  );

  const connectedUsers = await z.query.users;
  const filteredConnectedUsers = connectedUsers.filter((user) =>
    connectedUserIds.includes(user.id)
  );

  const result = {
    recommendedActivityEntries: filteredEntries,
    recommendedActivities: filteredActivities,
    recommendedUsers: [user, ...filteredConnectedUsers],
  };

  return result;
}

export async function getCurrentUser(z: Zero<Schema, Mutators>) {
  const user = await z.query.users
    .where("clerkId", z.userID)
    .related("activities", (q) => q.where("deletedAt", "IS", null))
    .related("activityEntries", (q) =>
      q.where("deletedAt", "IS", null).orderBy("createdAt", "desc")
    )
    .related("plans", (q) =>
      q
        .where("deletedAt", "IS", null)
        .orderBy("createdAt", "desc")
        .related("sessions", (q) => q.orderBy("date", "asc"))
        .related("activities")
        .related("planGroup")
        .related("milestones")
    )
    .related("notifications", (q) => q.orderBy("createdAt", "desc"))
    .one();

  if (!user) {
    throw new Error(`User not found for id: ${z.userID}`);
  }

  const connections = await z.query.connections.where(({ or, cmp }) =>
    or(cmp("fromId", z.userID), cmp("toId", z.userID))
  );

  // Get friends through connections - just the IDs
  const friends = connections
    .filter((conn) => conn.status === ConnectionStatus.ACCEPTED)
    .map((conn) =>
      conn.fromId === z.userID ? { id: conn.toId } : { id: conn.fromId }
    );

  const result = {
    ...user,
    connections,
    friends,
  };

  // return convertNumberToDates(result);
  return result;
}

export async function getOtherUser(
  z: Zero<Schema, Mutators>,
  args: { username: string }
) {
  const user = await z.query.users
    .where("username", args.username)
    .related("activities", (q) => q.where("deletedAt", "IS", null))
    .related("activityEntries", (q) =>
      q
        .where("deletedAt", "IS", null)
        .orderBy("createdAt", "desc")
        .related("reactions", (q) => q.related("user"))
        .related("comments", (q) => q.related("user"))
    )
    .related("plans", (q) =>
      q
        .where("deletedAt", "IS", null)
        .orderBy("createdAt", "desc")
        .related("activities")
    )
    .one();

  if (!user) {
    throw new Error("User not found");
  }

  // Filter public activities only
  const activities = user.activities.filter(
    (activity) =>
      activity.privacySettings === ActivityVisibility.PUBLIC ||
      activity.privacySettings == null
  );

  // Get friends through connections
  const connections = await z.query.connections.where(({ or, cmp }) =>
    or(cmp("fromId", z.userID), cmp("toId", z.userID))
  );

  // Get friends through connections - just the IDs
  const friends = connections
    .filter((conn) => conn.status === ConnectionStatus.ACCEPTED)
    .map((conn) =>
      conn.fromId === z.userID ? { id: conn.toId } : { id: conn.fromId }
    );

  const result = {
    ...user,
    activities,
    activityEntries: user.activityEntries,
    plans: user.plans,
    connections,
    friends,
  };

  // return convertNumberToDates(result);
  return result;
}

export async function getMessages(
  z: Zero<Schema, Mutators>,
  args: { userId: string }
) {
  const messages = await z.query.messages
    .where("userId", args.userId)
    .orderBy("createdAt", "desc");

  // Get emotions for each message
  const messagesWithEmotions: MessagesWithRelations[] = [];

  for (const message of messages) {
    const emotions = await z.query.message_emotions.where(
      "messageId",
      message.id
    );

    messagesWithEmotions.push({
      ...message,
      emotions,
    });
  }

  const result = {
    messages: messagesWithEmotions,
  };

  // return convertNumberToDates(result);
  return result;
}

export async function getMetricsAndEntries(
  z: Zero<Schema, Mutators>,
  args: { userId: string }
) {
  const metrics = await z.query.metrics
    .where("userId", args.userId)
    .orderBy("createdAt", "desc");

  const entries = await z.query.metric_entries
    .where("userId", args.userId)
    .orderBy("createdAt", "desc");

  const result = {
    metrics,
    entries,
  };

  // return convertNumberToDates(result);
  return result;
}
