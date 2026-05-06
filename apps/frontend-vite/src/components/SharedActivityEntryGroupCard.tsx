import type { TimelineActivityEntry, TimelineUser } from "@/contexts/timeline/service";
import { cn } from "@/lib/utils";
import { type Activity } from "@tsw/prisma";
import { format } from "date-fns";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

type SharedActivityGroupEntry = {
  entry: TimelineActivityEntry;
  activity: Activity;
  user: TimelineUser;
};

interface SharedActivityEntryGroupCardProps {
  items: SharedActivityGroupEntry[];
  className?: string;
  onUserClick?: (username: string) => void;
}

export default function SharedActivityEntryGroupCard({
  items,
  className,
  onUserClick,
}: SharedActivityEntryGroupCardProps) {
  if (items.length === 0) return null;

  const sortedItems = [...items].sort(
    (a, b) =>
      new Date(b.entry.datetime).getTime() - new Date(a.entry.datetime).getTime()
  );
  const anchor = sortedItems[0];
  const imageItem = sortedItems.find((item) => {
    if (!item.entry.imageUrl) return false;
    return !item.entry.imageExpiresAt || new Date(item.entry.imageExpiresAt) > new Date();
  });
  const participantLabel = sortedItems
    .map((item) => `@${item.user.username}`)
    .join(" · ");

  return (
    <div className={cn("bg-card border rounded-2xl overflow-hidden", className)}>
      {imageItem?.entry.imageUrl && (
        <div className="p-4 pb-0">
          <img
            src={imageItem.entry.imageUrl}
            alt={imageItem.activity.title}
            className="w-full max-h-[360px] object-cover rounded-2xl border border-white/20"
          />
        </div>
      )}

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {sortedItems.slice(0, 4).map(({ user }) => (
              <Avatar
                key={user.id}
                className="h-9 w-9 border-2 border-card cursor-pointer"
                onClick={() => user.username && onUserClick?.(user.username)}
              >
                <AvatarImage src={user.picture || ""} alt={user.name || ""} />
                <AvatarFallback>{(user.name || user.username || "U")[0]}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Joint activity</span>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {participantLabel}
            </div>
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(anchor.entry.datetime), "MMM d")}
          </div>
        </div>

        <div className="space-y-2">
          {sortedItems.map(({ entry, activity, user }) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl">{activity.emoji}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {activity.title}
                  </div>
                  <button
                    className="text-xs text-muted-foreground hover:underline"
                    onClick={() => user.username && onUserClick?.(user.username)}
                  >
                    @{user.username}
                  </button>
                </div>
              </div>
              <div className="text-sm font-semibold whitespace-nowrap">
                {entry.quantity} {activity.measure}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Linked from separate logs. Reactions and comments stay on each original activity for now.
        </p>
      </div>
    </div>
  );
}
