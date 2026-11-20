import type { ActivityEntry, Reaction } from "@/core/types";
import type { FeedItem } from "../types";

/**
 * Where an activity card's reactions live. A joint activity shows everyone's reactions from every
 * part, and a tap reacts to someone else's part, so the people in it can react to each other.
 */
export function entryReactions(item: FeedItem, meId?: string) {
  const entries = [item, ...(item.sharedEntries ?? [])]
    .map((row) => row.entry)
    .filter((entry): entry is ActivityEntry => !!entry);
  const target =
    entries.find((entry) => entry.userId !== meId) ?? item.entry;
  const reactions: Reaction[] = entries.flatMap(
    (entry) => entry.reactions ?? [],
  );
  const mine = (emoji: string) =>
    entries.filter((entry) =>
      (entry.reactions ?? []).some(
        (r) => r.emoji === emoji && (r.user?.id ?? r.userId) === meId,
      ),
    );
  return { target, reactions, mine };
}
