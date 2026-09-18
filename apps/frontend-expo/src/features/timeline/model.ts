import type { ActivityEntry, TimelinePage } from "@/core/types";
import type { FeedItem } from "./types";
export function mergeTimeline(pages: TimelinePage[]): FeedItem[] {
  const people = new Map(
    pages
      .flatMap((page) => page.recommendedUsers ?? [])
      .map((user) => [user.id, user]),
  );
  const activities = new Map(
    pages
      .flatMap((page) => page.recommendedActivities ?? [])
      .map((activity) => [activity.id, activity]),
  );
  const entries = new Map(
    pages
      .flatMap((page) => page.recommendedActivityEntries ?? [])
      .map((entry) => [entry.id, entry]),
  );
  // A shared participant can be embedded in a card before their own pagination page is loaded.
  for (const entry of [...entries.values()])
    for (const member of entry.sharedActivityEntry?.sharedActivity.entries ??
      []) {
      if (!people.has(member.user.id)) people.set(member.user.id, member.user);
      const nested = member.activityEntry;
      if (
        nested &&
        !entries.has(nested.id) &&
        nested.datetime &&
        nested.createdAt &&
        nested.quantity !== undefined &&
        nested.activityId &&
        nested.userId
      )
        entries.set(nested.id, nested as ActivityEntry);
    }
  const visible = [...entries.values()].filter((entry) => !entry.deletedAt);
  const links = new Map<string, Set<string>>(
    visible.map((entry) => [entry.id, new Set()]),
  );
  for (const entry of visible)
    for (const member of entry.sharedActivityEntry?.sharedActivity.entries ??
      []) {
      const id = member.activityEntryId ?? member.activityEntry?.id;
      if (id && links.has(id)) {
        links.get(entry.id)!.add(id);
        links.get(id)!.add(entry.id);
      }
    }
  const items: FeedItem[] = [];
  const seen = new Set<string>();
  for (const entry of visible) {
    if (seen.has(entry.id)) continue;
    const group: ActivityEntry[] = [];
    const queue = [entry.id];
    while (queue.length) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      group.push(entries.get(id)!);
      queue.push(...links.get(id)!);
    }
    const cards = group
      .sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime() ||
          b.id.localeCompare(a.id),
      )
      .map((row) => ({
        id: `activity-${row.id}`,
        date: new Date(row.datetime).getTime(),
        entry: row,
        user: people.get(row.userId),
        activity: row.activity ?? activities.get(row.activityId!),
      }));
    const [primary, ...sharedEntries] = cards;
    items.push({ ...primary, sharedEntries });
  }
  const achievements = new Map(
    pages
      .flatMap((page) => page.achievementPosts ?? [])
      .map((post) => [post.id, post]),
  );
  for (const achievement of achievements.values())
    items.push({
      id: `achievement-${achievement.id}`,
      date: new Date(achievement.createdAt).getTime(),
      achievement,
    });
  return items.sort((a, b) => b.date - a.date || a.id.localeCompare(b.id));
}
