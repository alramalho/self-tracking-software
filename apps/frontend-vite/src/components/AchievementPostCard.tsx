import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useActivities } from "@/contexts/activities/useActivities";
import { useTheme } from "@/contexts/theme/useTheme";
import { useCurrentUser } from "@/contexts/users";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import {
  differenceInCalendarDays,
  format,
  isToday,
  isYesterday,
} from "date-fns";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { type TimelineAchievementPost } from "@/contexts/timeline/service";
import { type Comment } from "@tsw/prisma";
import CommentSection from "./CommentSection";
import { ProgressRing } from "./ProgressRing";
import ReactionsList from "./ReactionsList";
import ReactionPicker from "./ReactionPicker";
import ImageCarousel from "./ImageCarousel";
import PlanDescription from "./PlanDescription";

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

interface ReactionCount {
  [key: string]: string[];
}

const getAchievementTitle = (
  type: string,
  streakNumber?: number | null
): string => {
  switch (type) {
    case "STREAK":
      return `${streakNumber} Week Streak!`;
    case "HABIT":
      return "Habit Formed!";
    case "LIFESTYLE":
      return "Lifestyle Achievement!";
    default:
      return "Achievement!";
  }
};

const getAchievementEmojis = (type: string): string[] => {
  switch (type) {
    case "STREAK":
      return ["🔥", "🔥"];
    case "HABIT":
      return ["⭐", "⭐"];
    case "LIFESTYLE":
      return ["🏆", "🏆"];
    default:
      return ["🎉", "🎉"];
  }
};

interface AchievementPostCardProps {
  achievementPost: TimelineAchievementPost;
  onAvatarClick?: () => void;
  onUsernameClick?: () => void;
}

const AchievementPostCard: React.FC<AchievementPostCardProps> = ({
  achievementPost,
  onAvatarClick,
  onUsernameClick,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<ReactionCount>({});
  const [showAllComments, setShowAllComments] = useState(false);

  useEffect(() => {
    setReactions(
      achievementPost.reactions?.reduce((acc, reaction) => {
        if (acc[reaction?.emoji]) {
          acc[reaction?.emoji] = [
            ...acc[reaction?.emoji],
            reaction?.user?.username || "",
          ];
        } else {
          acc[reaction?.emoji] = [reaction?.user?.username || ""];
        }
        return acc;
      }, {} as ReactionCount) || {}
    );
  }, [achievementPost.reactions]);

  const { currentUser } = useCurrentUser();
  const currentUserUsername = currentUser?.username;
  const isOwnPost = currentUser?.username === achievementPost.user.username;
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const { isLightMode } = useTheme();
  const accountLevel = useAccountLevel(achievementPost.user.username || undefined);

  // Use uploaded images if available, otherwise fall back to plan background
  const userImages = achievementPost.images || [];
  const effectiveImages = userImages.length > 0
    ? userImages
    : achievementPost.plan.backgroundImageUrl
      ? [{ url: achievementPost.plan.backgroundImageUrl, sortOrder: 0 }]
      : [];
  const hasImages = effectiveImages.length > 0;

  const {
    modifyReactionsOnAchievement,
    addCommentToAchievement,
    removeCommentFromAchievement,
    isAddingComment,
    isRemovingComment,
  } = useActivities();

  const comments = (achievementPost.comments || []) as (Comment & { user: { username: string; picture: string } })[];

  // Debounced reactions
  const pendingReactionsRef = useRef<{
    queue: Map<string, "add" | "remove">;
    timer: ReturnType<typeof setTimeout> | null;
  }>({
    queue: new Map<string, "add" | "remove">(),
    timer: null,
  });

  const processPendingReactions = useCallback(async () => {
    const { queue } = pendingReactionsRef.current;

    if (pendingReactionsRef.current.timer) {
      clearTimeout(pendingReactionsRef.current.timer);
      pendingReactionsRef.current.timer = null;
    }

    if (queue.size > 0) {
      const reactionsToModify = Array.from(queue.entries()).map(
        ([emoji, operation]) => ({
          emoji,
          operation,
        })
      );

      queue.clear();

      await toast.promise(
        modifyReactionsOnAchievement({
          achievementPostId: achievementPost.id,
          userUsername: achievementPost.user.username || "",
          reactions: reactionsToModify,
        }),
        {
          loading: "Updating reactions...",
          success: "Reactions updated successfully!",
          error: "Failed to update reactions.",
        }
      );
    }
  }, [achievementPost.id, achievementPost.user.username, modifyReactionsOnAchievement]);

  const scheduleReactionProcessing = useCallback(() => {
    if (pendingReactionsRef.current.timer) {
      clearTimeout(pendingReactionsRef.current.timer);
    }

    pendingReactionsRef.current.timer = setTimeout(() => {
      processPendingReactions();
    }, 2500);
  }, [processPendingReactions]);

  const queueReaction = useCallback(
    (emoji: string, operation: "add" | "remove") => {
      setReactions((prevReactions) => {
        const newReactions = { ...prevReactions };
        if (operation === "add") {
          if (newReactions[emoji]) {
            if (!newReactions[emoji].includes(currentUserUsername || "")) {
              newReactions[emoji] = [
                ...newReactions[emoji],
                currentUserUsername || "",
              ];
            }
          } else {
            newReactions[emoji] = [currentUserUsername || ""];
          }
        } else {
          if (newReactions[emoji]) {
            newReactions[emoji] = newReactions[emoji].filter(
              (username) => username !== currentUserUsername
            );
            if (newReactions[emoji].length === 0) {
              delete newReactions[emoji];
            }
          }
        }
        return newReactions;
      });
      scheduleReactionProcessing();
    },
    [currentUserUsername, scheduleReactionProcessing]
  );

  const handleReactionClick = (emoji: string) => {
    const usernames = reactions[emoji] || [];
    const hasReacted = usernames.includes(currentUserUsername || "");

    if (hasReacted) {
      queueReaction(emoji, "remove");
      pendingReactionsRef.current.queue.set(emoji, "remove");
    } else {
      queueReaction(emoji, "add");
      pendingReactionsRef.current.queue.set(emoji, "add");
    }

    setShowEmojiPicker(false);
  };

  const achievementEmojis = getAchievementEmojis(achievementPost.achievementType);
  const achievementTitle = getAchievementTitle(
    achievementPost.achievementType,
    achievementPost.streakNumber
  );

  return (
    <div className={`${variants.veryFadedBg} backdrop-blur-sm border rounded-2xl relative overflow-hidden`}>
      {/* Header with date */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-xs text-muted-foreground text-right">
          {getFormattedDate(achievementPost.createdAt)}
        </p>
      </div>

      {/* Achievement badge with avatar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl">{achievementEmojis[0]}</span>
          <span className="text-2xl">{achievementPost.plan.emoji}</span>
          <span className="text-3xl">{achievementEmojis[1]}</span>
        </div>
        <h3 className="text-xl font-bold text-center text-foreground mt-2">
          {achievementTitle}
        </h3>

        {/* Avatar positioned near achievement */}
        <div className="flex items-center justify-center mt-3">
          <ProgressRing
            size={40}
            strokeWidth={2}
            percentage={accountLevel.percentage}
            currentLevel={accountLevel.currentLevel}
            atLeastBronze={accountLevel.atLeastBronze}
            badge={false}
            badgeSize={40}
          >
            <Avatar
              className="w-10 h-10 cursor-pointer"
              style={{
                boxShadow: `0 0 0 2px ${
                  isLightMode ? "white" : "black"
                }, 0 0 0 5px ${accountLevel.currentLevel?.color}`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAvatarClick?.();
              }}
            >
              <AvatarImage
                src={achievementPost.user.picture || ""}
                alt={achievementPost.user.name || ""}
              />
              <AvatarFallback>
                {(achievementPost.user.name || "U")[0]}
              </AvatarFallback>
            </Avatar>
          </ProgressRing>
          <p
            onClick={(e) => {
              e.stopPropagation();
              onUsernameClick?.();
            }}
            className="ml-2 text-sm font-semibold text-foreground cursor-pointer hover:underline"
          >
            {achievementPost.user.username}
          </p>
        </div>
      </div>

      {/* Content area - images or inline content */}
      <div className={hasImages ? "relative" : "px-4 pb-4"}>
        {hasImages && (
          <div className="relative mx-4 mb-2">
            <div className="relative">
              <ImageCarousel images={effectiveImages} />

              {/* Description overlay on image */}
              <PlanDescription
                goal={achievementPost.plan.goal}
                message={achievementPost.message}
                overlay={true}
              />

              {/* Reactions overlay */}
              <div className="absolute top-2 left-2 z-30">
                <ReactionsList
                  reactions={reactions}
                  currentUsername={currentUserUsername || undefined}
                  onReactionClick={handleReactionClick}
                  variant="overlay"
                />
              </div>

              {/* Emoji picker button */}
              {!isOwnPost && (
                <div className="absolute bottom-2 right-2 z-30">
                  <ReactionPicker
                    show={showEmojiPicker}
                    onToggle={() => setShowEmojiPicker(!showEmojiPicker)}
                    onSelect={handleReactionClick}
                    variant="overlay"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content when no images */}
        {!hasImages && (
          <>
            <PlanDescription
              goal={achievementPost.plan.goal}
              message={achievementPost.message}
              overlay={false}
            />

            <ReactionsList
              reactions={reactions}
              currentUsername={currentUserUsername || undefined}
              onReactionClick={handleReactionClick}
              variant="inline"
            />

            {!isOwnPost && (
              <ReactionPicker
                show={showEmojiPicker}
                onToggle={() => setShowEmojiPicker(!showEmojiPicker)}
                onSelect={handleReactionClick}
                variant="inline"
              />
            )}
          </>
        )}

        {/* Comment section */}
        <div className={hasImages ? "mx-4 mb-2" : ""}>
          <CommentSection
            achievementPostId={achievementPost.id}
            comments={comments}
            onAddComment={(text) =>
              addCommentToAchievement({
                achievementPostId: achievementPost.id,
                userUsername: achievementPost.user.username || "",
                text,
              })
            }
            onRemoveComment={(commentId) =>
              removeCommentFromAchievement({
                achievementPostId: achievementPost.id,
                userUsername: achievementPost.user.username || "",
                commentId,
              })
            }
            hasImage={hasImages}
            showAllComments={showAllComments}
            onToggleShowAll={setShowAllComments}
            isAddingComment={isAddingComment}
            isRemovingComment={isRemovingComment}
          />
        </div>
      </div>
    </div>
  );
};

export default AchievementPostCard;
