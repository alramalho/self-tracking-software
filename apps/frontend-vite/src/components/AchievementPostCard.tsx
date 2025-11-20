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
import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { type TimelineAchievementPost } from "@/contexts/timeline/service";
import { type Comment } from "@tsw/prisma";
import CommentSection from "./CommentSection";
import { ProgressRing } from "./ProgressRing";
import ReactionsList from "./ReactionsList";
import ReactionPicker from "./ReactionPicker";
import ImageCarousel from "./ImageCarousel";
import AnimatedCounter from "./AnimatedCounter";
import JSConfetti from "js-confetti";

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

const getAchievementEmoji = (type: string): string => {
  switch (type) {
    case "STREAK":
      return "🔥";
    case "HABIT":
      return "⭐";
    case "LIFESTYLE":
      return "🏆";
    default:
      return "🎉";
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
  const accountLevel = useAccountLevel(
    achievementPost.user.username || undefined
  );

  // Use uploaded images if available, otherwise fall back to plan background
  const userImages = achievementPost.images || [];
  const effectiveImages =
    userImages.length > 0
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

  const comments = (achievementPost.comments || []) as (Comment & {
    user: { username: string; picture: string };
  })[];

  // JSConfetti instance
  const jsConfettiRef = useRef<JSConfetti | null>(null);

  useEffect(() => {
    // Initialize JSConfetti once
    jsConfettiRef.current = new JSConfetti();

    return () => {
      // Cleanup on unmount
      jsConfettiRef.current?.clearCanvas();
    };
  }, []);

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

      // Check if we're adding reactions (to trigger confetti)
      const hasAddReactions = reactionsToModify.some(r => r.operation === "add");

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

      // Trigger confetti only when reactions are successfully added
      if (hasAddReactions && jsConfettiRef.current) {
        const shootConfetti = () => {
          jsConfettiRef.current?.addConfetti({
            emojis: ['🎉', '⭐', '✨', '💫'],
            emojiSize: 40,
            confettiNumber: 30,
          });
        };

        shootConfetti();
        setTimeout(shootConfetti, 150);
      }
    }
  }, [
    achievementPost.id,
    achievementPost.user.username,
    modifyReactionsOnAchievement,
  ]);

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

  const achievementEmoji = getAchievementEmoji(achievementPost.achievementType);
  const achievementTitle = getAchievementTitle(
    achievementPost.achievementType,
    achievementPost.streakNumber
  );

  // For streak achievements, use the streak number for the counter
  const counterValue =
    achievementPost.achievementType === "STREAK"
      ? achievementPost.streakNumber || 0
      : 1;

  return (
    <div className="bg-card backdrop-blur-sm border rounded-2xl relative overflow-visible mb-10">
      {/* Image with overlays */}
      <div className="relative">
        {hasImages ? (
          <ImageCarousel images={effectiveImages} className="rounded-t-2xl" />
        ) : (
          <div className="bg-card rounded-t-2xl h-[24rem]" />
        )}

        {/* Top overlay - Date */}
        <div className="absolute top-3 right-3 z-20">
          <div className="px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md border border-white/20">
            <p className="text-xs text-white font-medium">
              {getFormattedDate(achievementPost.createdAt)}
            </p>
          </div>
        </div>

        {/* Top-left counter with animated fire */}
        <div className="absolute top-3 left-3 z-20">
          <AnimatedCounter
            count={counterValue}
            emoji={achievementEmoji}
            label={
              achievementPost.achievementType === "STREAK" ? "weeks" : undefined
            }
          />
        </div>

        {/* Center overlay - Avatar and Info Card */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3 px-6">
            {/* Avatar with progress ring */}
            <div className="relative">
              <ProgressRing
                size={80}
                strokeWidth={3}
                percentage={accountLevel.percentage}
                currentLevel={accountLevel.currentLevel}
                atLeastBronze={accountLevel.atLeastBronze}
                badge={false}
                badgeSize={80}
              >
                <Avatar
                  className="w-20 h-20 cursor-pointer ring-4 ring-white/20"
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
                  <AvatarFallback className="text-2xl">
                    {(achievementPost.user.name || "U")[0]}
                  </AvatarFallback>
                </Avatar>
              </ProgressRing>
            </div>

            {/* Info card with glass background */}
            <div className="bg-black/40 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-3 shadow-xl">
              <div className="flex items-center gap-2 mb-1 justify-center">
                <span className="text-4xl">{achievementPost.plan.emoji}</span>
              </div>
              <h3 className="text-2xl font-bold text-white text-center drop-shadow-lg">
                {achievementTitle}
              </h3>
              <p className="text-sm text-white/80 text-center mt-1">
                {achievementPost.plan.goal}
              </p>
              {achievementPost.message && (
                <p className="text-xs text-white/70 text-center mt-1 italic">
                  "{achievementPost.message}"
                </p>
              )}
              <p
                onClick={(e) => {
                  e.stopPropagation();
                  onUsernameClick?.();
                }}
                className="text-sm text-white/90 text-center mt-2 cursor-pointer hover:underline font-medium"
              >
                @{achievementPost.user.username}
              </p>
            </div>

            {/* Reactions section below the central card */}
            <div className="mt-4 flex flex-col items-center gap-2">
              {/* Existing reactions */}
              {reactions && Object.keys(reactions).length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  <ReactionsList
                    reactions={reactions}
                    currentUsername={currentUserUsername || undefined}
                    onReactionClick={handleReactionClick}
                    variant="overlay"
                  />
                </div>
              )}

              {/* Emoji picker button */}
              <ReactionPicker
                show={showEmojiPicker}
                onToggle={() => setShowEmojiPicker(!showEmojiPicker)}
                onSelect={handleReactionClick}
                variant="overlay"
              />
            </div>
          </div>
        </div>

        {/* Comment input overlay at bottom - styled like ActivityEntryPhotoCard description */}
        {currentUser && (
          <div className="absolute -bottom-5 left-0 right-0 z-30">
            <div className="relative -mb-4 mx-2">
              <CommentSection
                achievementPostId={achievementPost.id}
                comments={[]} // Only show input here, comments will be below
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
                hasImage={true}
                showAllComments={false}
                onToggleShowAll={() => {}}
                isAddingComment={isAddingComment}
                isRemovingComment={isRemovingComment}
                inputClassName="bg-transparent p-3 rounded-full border-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Comments list below the image */}
      {comments.length > 0 && (
        <div className="px-4 pb-4 pt-2 mt-10 bg-transparent">
          <CommentSection
            achievementPostId={achievementPost.id}
            comments={comments}
            onAddComment={() => Promise.resolve()} // No input here
            onRemoveComment={(commentId) =>
              removeCommentFromAchievement({
                achievementPostId: achievementPost.id,
                userUsername: achievementPost.user.username || "",
                commentId,
              })
            }
            hasImage={true}
            showAllComments={showAllComments}
            onToggleShowAll={setShowAllComments}
            isAddingComment={false}
            isRemovingComment={isRemovingComment}
            className="[&>div:last-child]:hidden" // Hide the input section, only show comments
          />
        </div>
      )}
    </div>
  );
};

export default AchievementPostCard;
