import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useApiWithAuth } from "@/api";
import { useActivities } from "@/contexts/activities/useActivities";
import { type PlanProgressData } from "@/contexts/plans-progress";
import { useTheme } from "@/contexts/theme/useTheme";
import { useCurrentUser, useUser } from "@/contexts/users";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { useThemeColors } from "@/hooks/useThemeColors";
import { extractFirstUrl } from "@/lib/linkUtils";
import { getThemeVariants } from "@/utils/theme";
import { ReactionBarSelector } from "@charkour/react-reactions";
import {
  type Activity,
  type ActivityEntry,
  type Comment,
  type PlanType,
  type Reaction,
} from "@tsw/prisma";
import {
  differenceInCalendarDays,
  format,
  isToday,
  isYesterday,
} from "date-fns";
import { Edit, Maximize2, Rocket, Smile, Sprout } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import BadgeExplainerPopover from "./BadgeExplainerPopover";
import CommentSection from "./CommentSection";
import ImageZoomDialog from "./ImageZoomDialog";
import LinkifiedText from "./LinkifiedText";
import LinkPreview from "./LinkPreview";
import { ProgressRing } from "./ProgressRing";
import { Separator } from "./ui/separator";

const getFormattedDate = (date: Date) => {
  const now = new Date();

  if (isToday(date)) {
    return "today";
  }

  if (isYesterday(date)) {
    return "yesterday";
  }

  const diffInCalendarDays = differenceInCalendarDays(now, date);

  if (diffInCalendarDays <= 7) {
    return `last ${format(date, "EEEE")}`;
  }

  return format(date, "MMM d");
};

const formatUsernameList = (usernames: string[]) => {
  const uniqueNames = Array.from(new Set(usernames.filter(Boolean)));
  if (uniqueNames.length === 0) return "";
  if (uniqueNames.length === 1) return uniqueNames[0];
  if (uniqueNames.length === 2) return `${uniqueNames[0]} and ${uniqueNames[1]}`;
  return `${uniqueNames.slice(0, -1).join(", ")}, and ${
    uniqueNames[uniqueNames.length - 1]
  }`;
};

type ActivityCardUser = {
  username: string;
  name?: string | null;
  picture?: string | null;
  planType?: PlanType;
};

const ParticipantAvatar = ({
  user,
  size = "md",
  isLightMode,
  onClick,
}: {
  user: ActivityCardUser;
  size?: "sm" | "md";
  isLightMode: boolean;
  onClick?: (user: ActivityCardUser) => void;
}) => {
  const accountLevel = useAccountLevel(user.username || undefined);
  const ringSize = size === "sm" ? 28 : 36;
  const avatarSize = size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const ringWidth = size === "sm" ? 1.5 : 2;
  const outerRing = size === "sm" ? 3 : 5;

  return (
    <ProgressRing
      size={ringSize}
      strokeWidth={ringWidth}
      percentage={accountLevel.percentage}
      currentLevel={accountLevel.currentLevel}
      atLeastBronze={accountLevel.atLeastBronze}
      badge={false}
      badgeSize={ringSize}
    >
      <Avatar
        className={`${avatarSize} ${onClick ? "cursor-pointer" : ""}`}
        style={{
          boxShadow: `0 0 0 2px ${
            isLightMode ? "white" : "black"
          }, 0 0 0 ${outerRing}px ${accountLevel.currentLevel?.color}`,
        }}
        onClick={(event) => {
          if (!onClick) return;
          event.stopPropagation();
          onClick(user);
        }}
      >
        <AvatarImage src={user.picture || ""} alt={user.name || ""} />
        <AvatarFallback>{(user.name || user.username || "U")[0]}</AvatarFallback>
      </Avatar>
    </ProgressRing>
  );
};

const ParticipantName = ({
  user,
  onClick,
}: {
  user: ActivityCardUser;
  onClick?: (user: ActivityCardUser) => void;
}) => {
  const accountLevel = useAccountLevel(user.username || undefined);

  return (
    <span
      className={onClick ? "cursor-pointer hover:underline" : ""}
      style={{ color: accountLevel.currentLevel?.color }}
      onClick={(event) => {
        if (!onClick) return;
        event.stopPropagation();
        onClick(user);
      }}
    >
      @{user.username}
    </span>
  );
};

const ParticipantNameList = ({
  users,
  onParticipantClick,
}: {
  users: ActivityCardUser[];
  onParticipantClick?: (user: ActivityCardUser) => void;
}) => {
  const uniqueUsers = users.filter(
    (participant, index, list) =>
      participant.username &&
      list.findIndex((item) => item.username === participant.username) === index
  );

  return (
    <>
      {uniqueUsers.map((participant, index) => (
        <React.Fragment key={participant.username}>
          {index > 0 && (
            <span className="text-muted-foreground">
              {index === uniqueUsers.length - 1 ? " and " : ", "}
            </span>
          )}
          <ParticipantName user={participant} onClick={onParticipantClick} />
        </React.Fragment>
      ))}
    </>
  );
};

type SharedActivityCardEntry = {
  activityEntry: ActivityEntry & {
    imageUrls?: string[];
  };
  activity: Activity;
  user: { username: string; name: string | null; picture: string | null; planType: PlanType };
};

interface ActivityEntryPhotoCardProps {
  activity: Activity;
  activityEntry: ActivityEntry & {
    reactions: (Reaction & { user: { username: string } })[];
    comments: (Comment & { user: { username: string; picture: string } })[];
    sharedActivityEntry?: {
      sharedActivity?: {
        entries?: {
          activityEntryId: string;
          user: { id: string; username: string | null; name?: string | null; picture?: string | null };
          activityEntry?: (ActivityEntry & {
            imageUrls?: string[];
            activity?: Activity | null;
            deletedAt?: Date | null;
          }) | null;
        }[];
      };
    } | null;
  };
  user: { username: string; name: string; picture: string; planType: PlanType };
  userPlansProgressData: PlanProgressData[];
  sharedActivityEntries?: SharedActivityCardEntry[];
  editable?: boolean;
  onEditClick?: () => void;
  onAvatarClick?: () => void;
  onUsernameClick?: () => void;
  onParticipantClick?: (username: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface ReactionCount {
  [key: string]: string[];
}

const REACTION_EMOJI_MAPPING = {
  fire: "🔥",
  rocket: "🚀",
  love: "♥️",
  laugh: "😂",
  oof: "😮‍💨",
  peach: "🍑",
  surprise: "😮",
};

const ActivityEntryPhotoCard: React.FC<ActivityEntryPhotoCardProps> = ({
  editable,
  onAvatarClick,
  onEditClick,
  onUsernameClick,
  onParticipantClick,
  activity,
  activityEntry,
  user,
  userPlansProgressData,
  sharedActivityEntries = [],
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<ReactionCount>({});
  const api = useApiWithAuth();

  useEffect(() => {
    setReactions(
      activityEntry.reactions?.reduce((acc, reaction) => {
        if (acc[reaction?.emoji]) {
          acc[reaction?.emoji] = [
            ...acc[reaction?.emoji],
            reaction?.user?.username,
          ];
        } else {
          acc[reaction?.emoji] = [reaction?.user?.username];
        }
        return acc;
      }, {} as ReactionCount) || {}
    );
  }, [activityEntry.reactions]);
  const { currentUser } = useCurrentUser();
  const currentUserUsername = currentUser?.username;
  const isOwnActivityEntry = currentUser?.username === user.username;
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const [showUserList, setShowUserList] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowReadMore, setShouldShowReadMore] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [showBadgeExplainer, setShowBadgeExplainer] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const { data: ownerUser } = useUser({ username: user.username || "" });
  const { isLightMode } = useTheme();
  const habitAchieved = userPlansProgressData?.some(
    (plan) => plan.habitAchievement.isAchieved
  );
  const lifestyleAchieved = userPlansProgressData?.some(
    (plan) => plan.lifestyleAchievement.isAchieved
  );
  const accountLevel = useAccountLevel(user.username || undefined);
  const handleParticipantClick = useCallback(
    (participant: ActivityCardUser) => {
      if (participant.username) {
        onParticipantClick?.(participant.username);
      }
    },
    [onParticipantClick]
  );

  const [showAllComments, setShowAllComments] = useState(false);
  const {
    modifyReactions,
    isModifyingReactions,
    addComment,
    removeComment,
    isAddingComment,
    isRemovingComment,
  } = useActivities();
  const [comments, setComments] = useState(activityEntry.comments || []);
  const commentsCount =
    (activityEntry as typeof activityEntry & { _count?: { comments?: number } })
      ._count?.comments ?? comments.length;
  const hasMoreComments = commentsCount > comments.length;

  useEffect(() => {
    setComments(activityEntry.comments || []);
  }, [activityEntry.comments]);

  const loadAllComments = useCallback(async () => {
    if (!hasMoreComments) return;
    const response = await api.get(
      `/activities/activity-entries/${activityEntry.id}/comments`
    );
    setComments(response.data.comments || []);
  }, [activityEntry.id, api, hasMoreComments]);

  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseInt(
        window.getComputedStyle(textRef.current).lineHeight
      );
      const height = textRef.current.scrollHeight;
      const lines = height / lineHeight;
      setShouldShowReadMore(lines > 3);
    }
  }, [activityEntry.description]);

  // Add new state and refs for debounced reactions with unified queue
  const pendingReactionsRef = useRef<{
    queue: Map<string, "add" | "remove">;
    timer: ReturnType<typeof setTimeout> | null;
  }>({
    queue: new Map<string, "add" | "remove">(),
    timer: null,
  });

  // Debounced method to process pending reactions using unified queue
  const processPendingReactions = useCallback(async () => {
    console.log("processing pending reactions");
    const { queue } = pendingReactionsRef.current;

    // Clear timer
    if (pendingReactionsRef.current.timer) {
      clearTimeout(pendingReactionsRef.current.timer);
      pendingReactionsRef.current.timer = null;
    }

    // Process queue if there are any pending reactions
    if (queue.size > 0) {
      const reactionsToModify = Array.from(queue.entries()).map(
        ([emoji, operation]) => ({
          emoji,
          operation,
        })
      );

      queue.clear(); // Clear the queue

      await toast.promise(
        modifyReactions({
          activityEntryId: activityEntry.id,
          userUsername: user.username || "",
          reactions: reactionsToModify,
        }),
        {
          loading: "Updating reactions...",
          success: "Reactions updated successfully!",
          error: "Failed to update reactions",
        }
      );
    }
  }, [activityEntry.id, modifyReactions]);

  // Create stable references to functions to avoid dependency issues
  const processPendingReactionsRef = useRef(processPendingReactions);

  // Keep the reference updated
  useEffect(() => {
    processPendingReactionsRef.current = processPendingReactions;
  }, [processPendingReactions]);

  // Schedule the reaction processing
  const scheduleReactionProcessing = useCallback(() => {
    if (pendingReactionsRef.current.timer) {
      clearTimeout(pendingReactionsRef.current.timer);
    }

    pendingReactionsRef.current.timer = setTimeout(() => {
      processPendingReactionsRef.current();
    }, 2500);
  }, []); // No dependencies - using ref instead

  // Queue a reaction using unified queue system
  const queueReaction = useCallback(
    (emoji: string, operation: "add" | "remove") => {
      setShowEmojiPicker(false);

      console.log(`Queueing ${operation} reaction for emoji: ${emoji}`);

      // Add to unified queue - this automatically replaces any previous operation for the same emoji
      pendingReactionsRef.current.queue.set(emoji, operation);

      // Optimistically update UI for better UX
      setReactions((prevReactions) => {
        const updatedReactions = { ...prevReactions };
        const username = currentUserUsername || "";

        if (operation === "add") {
          if (!updatedReactions[emoji]) {
            updatedReactions[emoji] = [username];
          } else if (!updatedReactions[emoji].includes(username)) {
            updatedReactions[emoji] = [...updatedReactions[emoji], username];
          }
        } else {
          if (updatedReactions[emoji]) {
            updatedReactions[emoji] = updatedReactions[emoji].filter(
              (name) => name !== username
            );
            if (updatedReactions[emoji].length === 0) {
              delete updatedReactions[emoji];
            }
          }
        }

        return updatedReactions;
      });

      scheduleReactionProcessing();
    },
    [currentUserUsername, scheduleReactionProcessing]
  );

  useEffect(() => {
    return () => {
      if (pendingReactionsRef.current.timer) {
        clearTimeout(pendingReactionsRef.current.timer);
      }

      if (pendingReactionsRef.current.queue.size > 0) {
        processPendingReactionsRef.current();
      }
    };
  }, []);

  const addReactionToQueue = useCallback(
    (emoji: string) => {
      queueReaction(emoji, "add");
    },
    [queueReaction]
  );

  const addRemoveReactionToQueue = useCallback(
    (emoji: string) => {
      queueReaction(emoji, "remove");
    },
    [queueReaction]
  );

  const handleReactionClick = async (emoji: string) => {
    if (isOwnActivityEntry) {
      setShowUserList((prev) => ({ ...prev, [emoji]: !prev[emoji] }));
    } else {
      const hasUserReacted = reactions[emoji]?.includes(
        currentUserUsername || ""
      );

      if (hasUserReacted) {
        if (showUserList[emoji]) {
          addRemoveReactionToQueue(emoji);
        } else {
          setShowUserList((prev) => ({ ...prev, [emoji]: true }));
        }
      } else {
        addReactionToQueue(emoji);
      }
    }
  };

  const formatUserList = (usernames: string[]) => {
    if (usernames.length === 0) return "";
    if (usernames.length === 1) return usernames[0];
    if (usernames.length === 2) return `${usernames[0]} & ${usernames[1]}`;
    return `${usernames.slice(0, -1).join(", ")} & ${
      usernames[usernames.length - 1]
    }`;
  };

  const getEntryImageUrls = (
    entry: ActivityEntry & { imageUrls?: string[] }
  ) => {
    if (entry.imageExpiresAt && new Date(entry.imageExpiresAt) < new Date()) {
      return [];
    }

    return [
      ...(entry.imageUrls || []),
      entry.imageUrl,
    ].filter((url): url is string => !!url);
  };

  const embeddedSharedActivityEntries = (
    activityEntry.sharedActivityEntry?.sharedActivity?.entries || []
  )
    .filter(
      (entry) =>
        entry.activityEntryId !== activityEntry.id &&
        !entry.activityEntry?.deletedAt &&
        entry.user.username &&
        entry.activityEntry?.activity
    )
    .map((entry) => ({
      activityEntry: entry.activityEntry as ActivityEntry & { imageUrls?: string[] },
      activity: entry.activityEntry!.activity as Activity,
      user: {
        username: entry.user.username as string,
        name: entry.user.name ?? null,
        picture: entry.user.picture ?? null,
        planType: user.planType,
      },
    }));

  const allSharedActivityEntries = Array.from(
    new Map(
      [...sharedActivityEntries, ...embeddedSharedActivityEntries].map((entry) => [
        entry.activityEntry.id,
        entry,
      ])
    ).values()
  );

  const imageUrls = Array.from(
    new Set([
      ...getEntryImageUrls(activityEntry as typeof activityEntry & { imageUrls?: string[] }),
      ...allSharedActivityEntries.flatMap(({ activityEntry }) =>
        getEntryImageUrls(activityEntry)
      ),
    ])
  );
  const hasImage = imageUrls.length > 0;
  const shouldShowNeonEffect = habitAchieved || lifestyleAchieved;

  // Extract first URL from description for link preview
  const firstUrl = useMemo(
    () => extractFirstUrl(activityEntry.description),
    [activityEntry.description]
  );

  if (!activity || !activityEntry) return null;

  const isMergedJointActivity = allSharedActivityEntries.length > 0;
  const activitySummaryRows = [
    { activityEntry, activity, user },
    ...allSharedActivityEntries,
  ];
  const jointParticipants = activitySummaryRows.map((row) => row.user);
  const sharedParticipants = (
    isMergedJointActivity
      ? []
      : activityEntry.sharedActivityEntry?.sharedActivity?.entries
          ?.filter(
            (entry) =>
              entry.activityEntryId !== activityEntry.id &&
              !entry.activityEntry?.deletedAt
          )
          ?.map((entry) => entry.user) ?? []
  ).filter((participant) => participant.username);
  const sharedParticipantLabel = formatUsernameList(
    sharedParticipants.map((participant) => `@${participant.username}`)
  );
  const mergedActivityLabel = formatUsernameList(
    activitySummaryRows.map(
      (row) =>
        `${row.activity.emoji} ${row.activity.title} (${row.activityEntry.quantity} ${row.activity.measure})`
    )
  );
  const mergedEmojiRows = activitySummaryRows.slice(0, 3);

  // Collapsed minimal view for cards without images
  const collapsedCardContent = (
    <div className="relative bg-card/50 backdrop-blur-sm border rounded-2xl overflow-visible p-4 px-5 flex items-center gap-2">
      <div className="relative flex flex-shrink-0 -space-x-1.5">
        {isMergedJointActivity ? (
          jointParticipants.slice(0, 3).map((participant) => (
            <ParticipantAvatar
              key={participant.username}
              user={participant}
              size="sm"
              isLightMode={isLightMode}
              onClick={handleParticipantClick}
            />
          ))
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onAvatarClick?.();
            }}
          >
            <ParticipantAvatar user={user} size="sm" isLightMode={isLightMode} />
          </div>
        )}
      </div>
      <div className="relative flex-shrink-0">
        {isMergedJointActivity ? (
          <div className="flex -space-x-1">
            {mergedEmojiRows.map((row) => (
              <span
                key={row.activityEntry.id}
                className="text-xl leading-none drop-shadow-sm"
              >
                {row.activity.emoji}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-3xl leading-none">{activity.emoji}</span>
        )}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-xs font-semibold text-foreground line-clamp-1">
          {isMergedJointActivity ? (
            <ParticipantNameList
              users={jointParticipants}
              onParticipantClick={handleParticipantClick}
            />
          ) : (
            activity.title
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {isMergedJointActivity
            ? mergedActivityLabel
            : `${activityEntry.quantity} ${activity.measure}`}
        </span>
        {sharedParticipantLabel && (
          <span className="text-[11px] text-muted-foreground line-clamp-1">
            with {sharedParticipantLabel}
          </span>
        )}
      </div>
      <div className="absolute top-1.5 right-1.5">
        <Maximize2 className="w-3 h-3 text-muted-foreground opacity-30" />
      </div>
    </div>
  );

  const cardContent = (
    <div
      className={
        "bg-card backdrop-blur-sm border rounded-2xl relative overflow-hidden"
      }
    >
      {hasImage && (
        <div className="relative max-h-full max-w-full mx-auto p-4 pb-0">
          <div className="relative rounded-2xl overflow-hidden backdrop-blur-lg shadow-lg border border-white/20">
            {imageUrls.length === 1 ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setZoomedImageUrl(imageUrls[0]);
                }}
                className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                aria-label={`Open ${activity.title} photo`}
              >
                <img
                  src={imageUrls[0]}
                  alt={activity.title}
                  className="w-full h-full max-h-[400px] object-cover rounded-2xl transition-transform duration-200 group-hover:scale-[1.01]"
                />
                <span className="absolute right-2 top-2 rounded-full bg-black/45 p-2 text-white opacity-0 shadow-md backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Maximize2 className="h-4 w-4" />
                </span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {imageUrls.map((imageUrl, index) => (
                  <button
                    key={imageUrl}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setZoomedImageUrl(imageUrl);
                    }}
                    className={`w-full object-cover ${
                      index === 0 && imageUrls.length === 3
                        ? "col-span-2 max-h-[300px]"
                        : "aspect-square"
                    } group relative cursor-zoom-in overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80`}
                    aria-label={`Open ${activity.title} photo ${index + 1}`}
                  >
                    <img
                      src={imageUrl}
                      alt={`${activity.title} proof ${index + 1}`}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                    <span className="absolute right-2 top-2 rounded-full bg-black/45 p-1.5 text-white opacity-0 shadow-md backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="absolute top-2 left-2 flex flex-col flex-nowrap items-start gap-2 z-30">
              {reactions &&
                Object.entries(reactions).map(([emoji, usernames]) => {
                  return (
                    <button
                      key={emoji}
                      onClick={() => handleReactionClick(emoji)}
                      className={`inline-flex border border-white/20 backdrop-blur-sm items-center rounded-full px-3 py-1.5 text-sm shadow-md transition-all gap-2 pointer-events-auto ${
                        usernames.includes(currentUserUsername || "")
                          ? variants.card.selected.glassBg
                          : variants.card.glassBg
                      }`}
                    >
                      <span className="text-base">{emoji}</span>
                      {showUserList[emoji] ? (
                        <span className="text-foreground font-medium">
                          {formatUserList(usernames)}
                        </span>
                      ) : (
                        <span className="text-foreground font-medium">
                          {usernames.length}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
            {hasImage && !isOwnActivityEntry && (
              <>
                <div
                  className={`absolute bottom-0 right-2 z-30 ${
                    activityEntry.description ? "mb-8" : "mb-2"
                  }`}
                >
                  {showEmojiPicker ? (
                    <ReactionBarSelector
                      iconSize={24}
                      style={{
                        border: `1px solid rgba(255, 255, 255, 0.2)`,
                        backgroundColor: "rgba(255, 255, 255, 0.5)",
                        zIndex: 40,
                      }}
                      reactions={Object.entries(REACTION_EMOJI_MAPPING).map(
                        ([key, value]) => ({
                          label: key,
                          node: <div>{value}</div>,
                          key,
                        })
                      )}
                      onSelect={(key: any) =>
                        handleReactionClick(
                          REACTION_EMOJI_MAPPING[
                            key as keyof typeof REACTION_EMOJI_MAPPING
                          ]
                        )
                      }
                    />
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEmojiPicker(!showEmojiPicker);
                      }}
                      className={`inline-flex ${variants.card.glassBg} border border-white/20 backdrop-blur-sm items-center space-x-1 rounded-full p-2 transition-all shadow-md`}
                    >
                      <Smile className={`h-6 w-6 text-foreground`} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {hasImage && firstUrl && (
            <div className="relative -mt-6 mx-2 mb-2">
              <LinkPreview url={firstUrl} />
            </div>
          )}
          {hasImage && activityEntry.description && (
            <div className={`relative mx-2 ${!firstUrl ? "-mt-6" : ""}`}>
              <div
                className={`relative rounded-2xl overflow-hidden ${variants.card.glassBg} backdrop-blur-lg shadow-lg border border-white/20 p-4`}
              >
                <div
                  className={`relative ${!isExpanded && "max-h-[4.5em]"} ${
                    shouldShowReadMore && !isExpanded && "overflow-hidden"
                  }`}
                >
                  <p
                    ref={textRef}
                    className="text-foreground font-medium text-sm relative z-10"
                  >
                    <LinkifiedText text={activityEntry.description} />
                  </p>
                  {shouldShowReadMore && !isExpanded && (
                    <div className="absolute bottom-0 right-0 left-0 h-6" />
                  )}
                </div>
                {shouldShowReadMore && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-muted-foreground underline text-xs font-medium mt-1"
                  >
                    {isExpanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Comment section for posts with images */}
          {hasImage && (
            <div className="mx-2 mt-2 relative z-10 bg-red">
              <CommentSection
                activityEntryId={activityEntry.id}
                comments={comments}
                onAddComment={(text) =>
                  addComment({
                    activityEntryId: activityEntry.id,
                    userUsername: user.username,
                    text,
                  })
                }
                onRemoveComment={(commentId) =>
                  removeComment({
                    activityEntryId: activityEntry.id,
                    userUsername: user.username,
                    commentId,
                  })
                }
                hasImage={true}
                showAllComments={showAllComments}
                onToggleShowAll={setShowAllComments}
                hasMoreComments={hasMoreComments}
                onLoadAllComments={loadAllComments}
                isAddingComment={isAddingComment}
                isRemovingComment={isRemovingComment}
              />
            </div>
          )}
        </div>
      )}
      <div className="p-4 flex flex-col flex-nowrap items-start justify-between">
        <div className="flex items-center justify-between w-full">
          {isMergedJointActivity ? (
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="flex flex-shrink-0 -space-x-2">
                  {jointParticipants.slice(0, 3).map((participant) => (
                    <ParticipantAvatar
                      key={participant.username}
                      user={participant}
                      isLightMode={isLightMode}
                      onClick={handleParticipantClick}
                    />
                  ))}
                </div>
                <div className="min-w-0 text-sm font-semibold">
                  <ParticipantNameList
                    users={jointParticipants}
                    onParticipantClick={handleParticipantClick}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="inline-flex w-fit items-center rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Joint activity
                </div>
                <div className="space-y-1">
                  {activitySummaryRows.map((row) => (
                    <div
                      key={row.activityEntry.id}
                      className="flex items-center gap-2 rounded-xl bg-muted/35 px-2 py-1 text-xs"
                    >
                      <span className="text-base leading-none">{row.activity.emoji}</span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-muted-foreground">
                          @{row.user.username}
                        </span>{" "}
                        <span className="font-semibold text-foreground">
                          {row.activity.title} - {row.activityEntry.quantity}{" "}
                          {row.activity.measure}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {getFormattedDate(activityEntry.datetime)}{" "}
                {activityEntry.timezone && `- 📍 ${activityEntry.timezone}`}
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="relative">
                <ProgressRing
                  size={32}
                  strokeWidth={2}
                  percentage={accountLevel.percentage}
                  currentLevel={accountLevel.currentLevel}
                  atLeastBronze={accountLevel.atLeastBronze}
                  badge={false}
                  badgeSize={32}
                >
                  <Avatar
                    className="w-8 h-8"
                    style={{
                      boxShadow: `0 0 0 2px ${
                        isLightMode ? "white" : "black"
                      }, 0 0 0 5px ${accountLevel.currentLevel?.color}`,
                    }}
                    onClick={onAvatarClick}
                  >
                    <AvatarImage src={user.picture || ""} alt={user.name || ""} />
                    <AvatarFallback>{(user.name || "U")[0]}</AvatarFallback>
                  </Avatar>
                </ProgressRing>
              </div>
              <span className="text-5xl h-full text-muted-foreground">
                {activity.emoji}
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 flex-row flex-nowrap">
                  <span
                    className="text-sm text-muted-foreground hover:underline cursor-pointer"
                    onClick={onUsernameClick}
                    style={{ color: accountLevel.currentLevel?.color }}
                  >
                    @{user.username}
                  </span>
                  {/* {accountLevel.atLeastBronze &&
                    accountLevel.currentLevel?.getIcon({
                      size: 16,
                      className: "drop-shadow-sm",
                    })} */}
                </div>
                <span className="font-semibold">
                  {activity.title} - {activityEntry.quantity} {activity.measure}
                </span>
                {sharedParticipantLabel && (
                  <span className="text-xs text-muted-foreground">
                    with {sharedParticipantLabel}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {getFormattedDate(activityEntry.datetime)}{" "}
                  {activityEntry.timezone && `- 📍 ${activityEntry.timezone}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Non-image posts: link preview (if link exists) */}
        {!hasImage && !isCollapsed && firstUrl && (
          <div className="mt-3">
            <LinkPreview url={firstUrl} />
          </div>
        )}

        {/* Non-image posts: description */}
        {!hasImage && !isCollapsed && activityEntry.description && (
          <div
            className={`mt-3 ${!isExpanded && "max-h-[4.5em]"} ${
              shouldShowReadMore && !isExpanded && "overflow-hidden"
            } relative`}
          >
            <p ref={textRef} className="text-foreground text-sm">
              <LinkifiedText text={activityEntry.description} />
            </p>
            {shouldShowReadMore && !isExpanded && (
              <div className="absolute bottom-0 right-0 left-0 h-6" />
            )}
            {shouldShowReadMore && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-blue-500 text-xs font-medium mt-1 hover:text-blue-600"
              >
                {isExpanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {!hasImage && !isCollapsed && (
          <>
            <Separator className="my-2" />
            <div className="mt-3 w-full relative z-10">
              <CommentSection
                activityEntryId={activityEntry.id}
                comments={comments}
                onAddComment={(text) =>
                  addComment({
                    activityEntryId: activityEntry.id,
                    userUsername: user.username,
                    text,
                  })
                }
                onRemoveComment={(commentId) =>
                  removeComment({
                    activityEntryId: activityEntry.id,
                    userUsername: user.username,
                    commentId,
                  })
                }
                hasImage={false}
                fullWidth={true}
                showAllComments={showAllComments}
                onToggleShowAll={setShowAllComments}
                hasMoreComments={hasMoreComments}
                onLoadAllComments={loadAllComments}
                isAddingComment={isAddingComment}
                isRemovingComment={isRemovingComment}
              />
            </div>
          </>
        )}

        <div>
          {editable && onEditClick && (
            <button
              onClick={onEditClick}
              className="absolute top-2 right-2 p-1 bg-card/80 rounded-full shadow-md hover:bg-muted"
            >
              <Edit className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Sprout/Rocket badge moved inside the card */}
      {!editable && ( // dont show in profile page
        <div
          onClick={() => setShowBadgeExplainer(true)}
          className={`space-y-2 absolute -bottom-5 -right-9 flex flex-col gap-2 z-0`}
        >
          {habitAchieved && !lifestyleAchieved && (
            <div className="flex flex-row items-center gap-2">
              <Sprout size={120} className="text-lime-500 opacity-20" />
            </div>
          )}
          {lifestyleAchieved && (
            <div className="flex flex-row items-center gap-2">
              <Rocket size={120} className="text-amber-500 opacity-20" />
            </div>
          )}
        </div>
      )}
    </div>
  );
  return (
    <motion.div
      layout
      initial={false}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      onClick={() => !hasImage && onToggleCollapse?.()}
      className={`relative rounded-2xl ${!hasImage ? "cursor-pointer" : ""}`}
    >
      {!hasImage && isCollapsed ? collapsedCardContent : cardContent}
      {shouldShowNeonEffect && (
        <BadgeExplainerPopover
          open={showBadgeExplainer}
          onClose={() => setShowBadgeExplainer(false)}
          user={user}
          planIds={ownerUser?.plans?.map((plan) => plan.id) || []}
          badgeType={lifestyleAchieved ? "lifestyles" : "habits"}
          userPlansProgressData={userPlansProgressData}
        />
      )}
      {zoomedImageUrl && (
        <ImageZoomDialog
          open={!!zoomedImageUrl}
          onOpenChange={(open) => {
            if (!open) {
              setZoomedImageUrl(null);
            }
          }}
          src={zoomedImageUrl}
          alt={`${activity.title} photo`}
        />
      )}
    </motion.div>
  );
};

export default ActivityEntryPhotoCard;
