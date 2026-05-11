import AppleLikePopover from "@/components/AppleLikePopover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useCurrentUser } from "@/contexts/users";
import type { ReturnedActivityEntriesType } from "@/contexts/activities/types";
import { type Activity } from "@tsw/prisma";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import Picker from "react-mobile-picker";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil } from "lucide-react";

interface ActivityLoggerPopoverProps {
  open: boolean;
  onClose: () => void;
  selectedActivity: Activity;
  activityEntries?: ReturnedActivityEntriesType;
  onSubmit: (data: {
    activityId: string;
    datetime: Date;
    quantity: number;
    withUserId?: string;
  }) => void;
}

type FriendOption = {
  id: string;
  username: string | null;
  name: string | null;
  picture: string | null;
  connectedAt?: Date | string | null;
};

function getDisplayName(user: {
  name?: string | null;
  username?: string | null;
}) {
  return user.name || (user.username ? `@${user.username}` : "Unknown user");
}

function getAvatarFallback(user: {
  name?: string | null;
  username?: string | null;
}) {
  const source = user.name || user.username || "?";
  return source.trim().slice(0, 1).toUpperCase();
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function sortFriendsBySharedActivity(
  friends: FriendOption[],
  activityEntries: ReturnedActivityEntriesType = []
) {
  const statsByUserId = new Map<string, { count: number; latestAt: number }>();

  for (const entry of activityEntries) {
    const sharedEntries = entry.sharedActivityEntry?.sharedActivity?.entries || [];
    if (sharedEntries.length < 2) continue;

    const entryTime = new Date(entry.datetime).getTime();
    for (const sharedEntry of sharedEntries) {
      const userId = sharedEntry.user?.id;
      if (!userId || userId === entry.userId || sharedEntry.activityEntry?.deletedAt) {
        continue;
      }

      const stats = statsByUserId.get(userId) || { count: 0, latestAt: 0 };
      stats.count += 1;
      stats.latestAt = Math.max(stats.latestAt, Number.isNaN(entryTime) ? 0 : entryTime);
      statsByUserId.set(userId, stats);
    }
  }

  return [...friends].sort((a, b) => {
    const aStats = statsByUserId.get(a.id) || { count: 0, latestAt: 0 };
    const bStats = statsByUserId.get(b.id) || { count: 0, latestAt: 0 };

    if (aStats.count !== bStats.count) {
      return bStats.count - aStats.count;
    }

    if (aStats.latestAt !== bStats.latestAt) {
      return bStats.latestAt - aStats.latestAt;
    }

    const aConnectedAt = a.connectedAt ? new Date(a.connectedAt).getTime() : 0;
    const bConnectedAt = b.connectedAt ? new Date(b.connectedAt).getTime() : 0;
    if (aConnectedAt !== bConnectedAt) {
      return bConnectedAt - aConnectedAt;
    }

    return getDisplayName(a).localeCompare(getDisplayName(b));
  });
}

export function ActivityLoggerPopover({
  open,
  onClose,
  selectedActivity,
  activityEntries = [],
  onSubmit,
}: ActivityLoggerPopoverProps) {
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(now);
  const [quantity, setQuantity] = useState<number>(0);
  const [time, setTime] = useState({
    hour: now.getHours().toString().padStart(2, '0'),
    minute: now.getMinutes().toString().padStart(2, '0'),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTimePickerExpanded, setIsTimePickerExpanded] = useState(false);
  const [selectedWithUserId, setSelectedWithUserId] = useState<string | undefined>();
  const { currentUser } = useCurrentUser();
  const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const acceptedFriends = useMemo(() => {
    const friends: FriendOption[] = [
      ...(currentUser?.connectionsFrom || [])
        .filter((connection) => connection.status === "ACCEPTED")
        .map((connection): FriendOption => ({
          id: connection.to.id,
          username: connection.to.username,
          name: connection.to.name,
          picture: connection.to.picture,
          connectedAt: connection.updatedAt || connection.createdAt,
        })),
      ...(currentUser?.connectionsTo || [])
        .filter((connection) => connection.status === "ACCEPTED")
        .map((connection): FriendOption => ({
          id: connection.from.id,
          username: connection.from.username,
          name: connection.from.name,
          picture: connection.from.picture,
          connectedAt: connection.updatedAt || connection.createdAt,
        })),
    ];

    const uniqueFriends = friends.filter(
      (user, index, all) =>
        all.findIndex((candidate) => candidate.id === user.id) === index
    );

    return sortFriendsBySharedActivity(uniqueFriends, activityEntries);
  }, [activityEntries, currentUser?.connectionsFrom, currentUser?.connectionsTo]);

  const firstWithUserPage = useMemo(() => acceptedFriends.slice(0, 8), [acceptedFriends]);
  const additionalWithUserPages = useMemo(
    () => chunk(acceptedFriends.slice(8), 9),
    [acceptedFriends]
  );

  // Generate hours and minutes options
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  const handleQuantityChange = (amount: number) => {
    setQuantity(Math.max(0, quantity + amount));
  };

  const handleQuickSelect = (value: number) => {
    setQuantity(value);
  };

  const formatTimeReadable = (hour: string, minute: string) => {
    const hourNum = parseInt(hour);
    const minuteNum = parseInt(minute);

    if (minuteNum === 0) {
      return `at ${hourNum} o'clock`;
    }
    return `at ${hourNum}:${minute}`;
  };

  const handleSubmit = () => {
    if (!selectedDate) {
      toast.error("Please select a date.");
      return;
    }

    if (quantity === 0) {
      toast.error("Please set a quantity.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Combine selected date with selected time
      const datetime = new Date(selectedDate);
      datetime.setHours(parseInt(time.hour), parseInt(time.minute), 0, 0);

      console.log({ datetime });
      onSubmit({
        activityId: selectedActivity.id,
        datetime,
        quantity,
        withUserId: selectedWithUserId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppleLikePopover open={open} onClose={onClose}>
      <div className="space-y-6 p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">
            Log {selectedActivity.title}
          </h2>
          <div className="text-4xl mb-4">{selectedActivity.emoji}</div>
          <p className="text-xs font-normal text-center my-4">
            <span className="italic">📍 {currentTimezone}</span>
          </p>
        </div>

        <div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date: Date | undefined) => {
              if (date) {
                setSelectedDate(date);
              }
            }}
            className="rounded-md border mx-auto"
            disableFutureDates={true}
          />
        </div>

        <div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">{formatTimeReadable(time.hour, time.minute)}</span>
            <button
              type="button"
              onClick={() => setIsTimePickerExpanded(!isTimePickerExpanded)}
              className="p-1 hover:bg-accent rounded-md transition-colors"
              aria-label="Edit time"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          <AnimatePresence>
            {isTimePickerExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div
                  className="mt-4"
                  onTouchMove={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold mb-2 text-center">
                    Select Time
                  </h3>
                  <div className="max-w-xs mx-auto">
                    <Picker
                      value={time}
                      onChange={setTime}
                      wheelMode="normal"
                      height={180}
                    >
                      <Picker.Column name="hour">
                        {hours.map(hour => (
                          <Picker.Item key={hour} value={hour}>
                            {hour}
                          </Picker.Item>
                        ))}
                      </Picker.Column>
                      <Picker.Column name="minute">
                        {minutes.map(minute => (
                          <Picker.Item key={minute} value={minute}>
                            {minute}
                          </Picker.Item>
                        ))}
                      </Picker.Column>
                    </Picker>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4 text-center">
            how many <i>{selectedActivity.measure}</i>?
          </h3>
          <div className="flex items-center justify-center space-x-4">
            <Button
              onClick={() => handleQuantityChange(-1)}
              variant="outline"
              size="icon"
              className="bg-card"
            >
              -
            </Button>
            <span className="text-2xl font-bold">{quantity}</span>
            <Button
              onClick={() => handleQuantityChange(1)}
              variant="outline"
              size="icon"
              className="bg-card"
            >
              +
            </Button>
          </div>
          <div className="mt-4 flex justify-center space-x-2">
            {[10, 30, 45, 60, 90].map((value) => (
              <Button
                key={value}
                onClick={() => handleQuickSelect(value)}
                variant="secondary"
                className="bg-card"
                size="sm"
              >
                {value}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4 text-center">
            who did this with you?
          </h3>
          {acceptedFriends.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1">
              <div className="grid min-w-full shrink-0 snap-start grid-cols-3 grid-rows-3 gap-3 justify-items-center">
                <button
                  type="button"
                  aria-label="Just me"
                  title="Just me"
                  className={`rounded-full p-0.5 transition ${
                    !selectedWithUserId
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "opacity-80"
                  }`}
                  onClick={() => setSelectedWithUserId(undefined)}
                >
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={currentUser?.picture || "/default-avatar.png"} />
                    <AvatarFallback>{getAvatarFallback(currentUser || {})}</AvatarFallback>
                  </Avatar>
                  <span className="sr-only">Just me</span>
                </button>
                {firstWithUserPage.map((friend) => {
                  const displayName = getDisplayName(friend);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      aria-label={displayName}
                      title={displayName}
                      className={`rounded-full p-0.5 transition ${
                        selectedWithUserId === friend.id
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : "opacity-80"
                      }`}
                      onClick={() => setSelectedWithUserId(friend.id)}
                    >
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={friend.picture || "/default-avatar.png"} />
                        <AvatarFallback>{getAvatarFallback(friend)}</AvatarFallback>
                      </Avatar>
                      <span className="sr-only">{displayName}</span>
                    </button>
                  );
                })}
              </div>
              {additionalWithUserPages.map((page, pageIndex) => (
                <div
                  key={`with-user-page-${pageIndex + 1}`}
                  className="grid min-w-full shrink-0 snap-start grid-cols-3 grid-rows-3 gap-3 justify-items-center"
                >
                  {page.map((friend) => {
                    const displayName = getDisplayName(friend);
                    return (
                      <button
                        key={friend.id}
                        type="button"
                        aria-label={displayName}
                        title={displayName}
                        className={`rounded-full p-0.5 transition ${
                          selectedWithUserId === friend.id
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "opacity-80"
                        }`}
                        onClick={() => setSelectedWithUserId(friend.id)}
                      >
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={friend.picture || "/default-avatar.png"} />
                          <AvatarFallback>{getAvatarFallback(friend)}</AvatarFallback>
                        </Avatar>
                        <span className="sr-only">{displayName}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Add friends to invite someone while logging.
            </p>
          )}
          {selectedWithUserId && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              They’ll get an invite and can accept it when they log their activity.
            </p>
          )}
        </div>

        <Button
          className="w-full"
          disabled={quantity === 0 || !selectedDate || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "Logging..." : "Log Activity"}
        </Button>
      </div>
    </AppleLikePopover>
  );
}
