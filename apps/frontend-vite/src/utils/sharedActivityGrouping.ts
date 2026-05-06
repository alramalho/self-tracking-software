export type FeedActivityItem<TActivity> = {
  type: "activity";
  data: TActivity;
};

export type FeedAchievementItem<TAchievement> = {
  type: "achievement";
  data: TAchievement;
};

export type FeedSharedActivityItem<TActivity> = {
  type: "sharedActivity";
  sharedActivityId: string;
  entries: TActivity[];
};

type LinkableActivityEntry = {
  id: string;
  sharedActivityEntry?: {
    sharedActivityId?: string | null;
    sharedActivity?: { id?: string | null } | null;
  } | null;
};

export type GroupedFeedItem<TActivity, TAchievement> =
  | FeedActivityItem<TActivity>
  | FeedAchievementItem<TAchievement>
  | FeedSharedActivityItem<TActivity>;

function getSharedActivityId(entry: LinkableActivityEntry): string | null {
  return (
    entry.sharedActivityEntry?.sharedActivityId ||
    entry.sharedActivityEntry?.sharedActivity?.id ||
    null
  );
}

export function groupSharedActivityItems<
  TActivity extends LinkableActivityEntry,
  TAchievement,
>(
  items: Array<FeedActivityItem<TActivity> | FeedAchievementItem<TAchievement>>
): Array<GroupedFeedItem<TActivity, TAchievement>> {
  const visibleSharedEntries = new Map<string, TActivity[]>();

  for (const item of items) {
    if (item.type !== "activity") continue;

    const sharedActivityId = getSharedActivityId(item.data);
    if (!sharedActivityId) continue;

    const existing = visibleSharedEntries.get(sharedActivityId) || [];
    existing.push(item.data);
    visibleSharedEntries.set(sharedActivityId, existing);
  }

  const emittedSharedActivities = new Set<string>();

  const groupedItems: Array<GroupedFeedItem<TActivity, TAchievement>> = [];

  for (const item of items) {
    if (item.type !== "activity") {
      groupedItems.push(item);
      continue;
    }

    const sharedActivityId = getSharedActivityId(item.data);
    if (!sharedActivityId) {
      groupedItems.push(item);
      continue;
    }

    const entries = visibleSharedEntries.get(sharedActivityId) || [];
    if (entries.length < 2) {
      groupedItems.push(item);
      continue;
    }

    if (emittedSharedActivities.has(sharedActivityId)) continue;

    emittedSharedActivities.add(sharedActivityId);
    groupedItems.push({ type: "sharedActivity", sharedActivityId, entries });
  }

  return groupedItems;
}

export function getGroupedFeedItemDate<
  TActivity extends { datetime: Date | string },
  TAchievement extends { createdAt: Date | string },
>(item: GroupedFeedItem<TActivity, TAchievement>): Date {
  if (item.type === "activity") return new Date(item.data.datetime);
  if (item.type === "achievement") return new Date(item.data.createdAt);

  return item.entries.reduce((newest, entry) => {
    const entryDate = new Date(entry.datetime);
    return entryDate > newest ? entryDate : newest;
  }, new Date(item.entries[0]?.datetime || 0));
}
