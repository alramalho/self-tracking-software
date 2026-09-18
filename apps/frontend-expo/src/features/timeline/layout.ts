import type { ActivityEntry } from "@/core/types";
import type { FeedItem, TimelineRow } from "./types";

function entryPhotos(entry?: ActivityEntry) {
  if (
    !entry ||
    (entry.imageExpiresAt && new Date(entry.imageExpiresAt) <= new Date())
  )
    return [];
  return [
    ...(entry.imageUrls ?? []),
    ...(entry.imageUrl ? [entry.imageUrl] : []),
  ];
}

export function feedPhotos(item: FeedItem) {
  return [
    ...new Set(
      item.entry
        ? [
            ...entryPhotos(item.entry),
            ...(item.sharedEntries ?? []).flatMap((shared) =>
              entryPhotos(shared.entry),
            ),
          ]
        : (item.achievement?.images?.map((image) => image.url) ?? []),
    ),
  ];
}

export function containsEntry(item: FeedItem, entryId?: string) {
  return (
    !!entryId &&
    (item.entry?.id === entryId ||
      !!item.sharedEntries?.some((shared) => shared.entry?.id === entryId))
  );
}

// Pair only adjacent compact cards. Photos, expanded cards and the seen divider
// occupy a full row without changing chronological order or splitting shared logs.
export function timelineRows(
  rows: TimelineRow[],
  expanded: ReadonlySet<string>,
  highlightedEntryId?: string,
): TimelineRow[] {
  const result: TimelineRow[] = [];
  for (const row of rows) {
    const compact =
      !!row.item?.entry &&
      !expanded.has(row.id) &&
      !containsEntry(row.item, highlightedEntryId) &&
      feedPhotos(row.item).length === 0;
    const previous = result.at(-1);
    if (compact && previous?.compact && !previous.secondary)
      previous.secondary = row.item;
    else result.push({ ...row, compact });
  }
  return result;
}
