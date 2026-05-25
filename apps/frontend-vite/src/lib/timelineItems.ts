type SharedActivityEntryLike = {
  id: string;
  sharedActivityEntry?: {
    sharedActivityId?: string | null;
    sharedActivity?: {
      id?: string | null;
      entries?: Array<{ activityEntryId: string; activityEntry?: { deletedAt?: Date | string | null } | null }>;
    } | null;
  } | null;
};

export function getSharedActivityKey(entry: SharedActivityEntryLike): string | null {
  return (
    entry.sharedActivityEntry?.sharedActivityId ||
    entry.sharedActivityEntry?.sharedActivity?.id ||
    null
  );
}

export function isDeletedSharedActivityEntry(entry: {
  activityEntry?: { deletedAt?: Date | string | null } | null;
}) {
  return Boolean(entry.activityEntry?.deletedAt);
}

export function shouldRenderSharedActivityEntry<T extends SharedActivityEntryLike>(
  entry: T,
  renderedSharedActivityIds: Set<string>
) {
  const sharedActivityId = getSharedActivityKey(entry);
  if (!sharedActivityId) return true;
  if (renderedSharedActivityIds.has(sharedActivityId)) return false;
  renderedSharedActivityIds.add(sharedActivityId);
  return true;
}

export function dedupeSharedActivityEntries<T extends SharedActivityEntryLike>(
  entries: T[]
) {
  const renderedSharedActivityIds = new Set<string>();
  return entries.filter((entry) =>
    shouldRenderSharedActivityEntry(entry, renderedSharedActivityIds)
  );
}
