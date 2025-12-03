import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useActivities } from "@/contexts/activities/useActivities";
import { useTheme } from "@/contexts/theme/useTheme";
import { useCurrentUser } from "@/contexts/users";
import { useAccountLevel, getAccountLevels } from "@/hooks/useAccountLevel";
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
import { Trash2, Pencil, Target, Sprout, Rocket } from "lucide-react";
import { type TimelineAchievementPost } from "@/contexts/timeline/service";
import { type Comment } from "@tsw/prisma";
import CommentSection from "./CommentSection";
import { ProgressRing } from "./ProgressRing";
import ReactionsList from "./ReactionsList";
import ReactionPicker from "./ReactionPicker";
import ImageCarousel from "./ImageCarousel";
import AnimatedCounter from "./AnimatedCounter";
import JSConfetti from "js-confetti";
import ConfirmDialogOrPopover from "./ConfirmDialogOrPopover";
import MedalExplainerPopover from "./MedalExplainerPopover";
import AchievementEditDialog from "./AchievementEditDialog";

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
  streakNumber?: number | null,
  levelName?: string | null
): string => {
  switch (type) {
    case "STREAK":
      return `${streakNumber} Week Streak!`;
    case "HABIT":
      return "Habit Formed!";
    case "LIFESTYLE":
      return "Lifestyle Achievement!";
    case "LEVEL_UP":
      return `Reached ${levelName}!`;
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
    case "LEVEL_UP":
      return "🎖️";
    default:
      return "🎉";
  }
};

interface AchievementPostCardProps {
  achievementPost: TimelineAchievementPost;
  onAvatarClick?: () => void;
  onUsernameClick?: () => void;
  editable?: boolean;
  onDeleteClick?: () => void;
}

const AchievementPostCard: React.FC<AchievementPostCardProps> = ({
  achievementPost,
  onAvatarClick,
  onUsernameClick,
  editable = false,
  onDeleteClick,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<ReactionCount>({});
  const [showAllComments, setShowAllComments] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [replyToUsername, setReplyToUsername] = useState<string | undefined>();
  const [showMedalExplainer, setShowMedalExplainer] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

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
      : achievementPost.plan?.backgroundImageUrl
      ? [{ url: achievementPost.plan.backgroundImageUrl, sortOrder: 0 }]
      : [];
  const hasImages = effectiveImages.length > 0;
  const isLevelUp = achievementPost.achievementType === "LEVEL_UP";

  // Get the level icon for level-up achievements
  const levelIcon = React.useMemo(() => {
    if (!isLevelUp || !achievementPost.levelName) return null;
    const levels = getAccountLevels(!isLightMode);
    const level = levels.find(l => l.name === achievementPost.levelName);
    return level?.getIcon({ size: 40 });
  }, [isLevelUp, achievementPost.levelName, isLightMode]);

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
    achievementPost.streakNumber,
    achievementPost.levelName
  );

  // For streak achievements, use the streak number for the counter
  // For level-up, don't show counter
  const counterValue =
    achievementPost.achievementType === "STREAK"
      ? achievementPost.streakNumber || 0
      : isLevelUp
      ? 0
      : 1;

  return (
    <div className="bg-card backdrop-blur-sm border rounded-2xl relative overflow-visible mb-12">
      {/* Image with overlays */}
      <div className="relative">
        {hasImages ? (
          <ImageCarousel images={effectiveImages} className="rounded-t-2xl" />
        ) : (
          <div className="bg-card rounded-t-2xl h-[24rem]" />
        )}

        {/* Top overlay - Date and Delete button */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-white/70 dark:bg-black/30 backdrop-blur-md border border-black/10 dark:border-white/20">
            <p className="text-xs text-gray-800 dark:text-white font-medium">
              {getFormattedDate(achievementPost.createdAt)}
            </p>
          </div>
          {editable && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEditDialog(true);
                }}
                className="p-2 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/20 dark:hover:bg-white/30 backdrop-blur-md border border-black/10 dark:border-white/20 transition-colors"
                title="Edit achievement post"
              >
                <Pencil size={16} className="text-gray-800 dark:text-white" />
              </button>
              {onDeleteClick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }}
                  className="p-2 rounded-full bg-red-500/80 hover:bg-red-600/90 backdrop-blur-md border border-red-300/30 dark:border-white/20 transition-colors"
                  title="Delete achievement post"
                >
                  <Trash2 size={16} className="text-white" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Top-left counter */}
        <div className="absolute top-3 left-3 z-20">
          {isLevelUp ? (
            <AnimatedCounter
              count={accountLevel.totalPoints}
              emoji="⭐"
              label="points"
            />
          ) : (
            <AnimatedCounter
              count={counterValue}
              emoji={achievementEmoji}
              label={
                achievementPost.achievementType === "STREAK" ? "weeks" : undefined
              }
            />
          )}
        </div>

        {/* Center overlay - Avatar and Info Card */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
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
            <div
              className={`bg-white/70 dark:bg-black/40 backdrop-blur-md border border-black/10 dark:border-white/20 rounded-2xl px-6 py-3 shadow-xl mx-12 ${isLevelUp ? "cursor-pointer hover:bg-white/80 dark:hover:bg-black/50 transition-colors" : ""}`}
              onClick={() => isLevelUp && setShowMedalExplainer(true)}
            >
              <div className="flex items-center gap-2 mb-1 justify-center">
                <span className="text-4xl">
                  {isLevelUp ? (levelIcon || achievementEmoji) : achievementPost.plan?.emoji}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center drop-shadow-lg">
                {achievementTitle}
              </h3>
              {!isLevelUp && achievementPost.plan?.goal && (
                <p className="text-sm text-gray-700 dark:text-white/80 text-center mt-1">
                  {achievementPost.plan.goal}
                </p>
              )}
              {isLevelUp && (
                <div className="text-sm text-gray-700 dark:text-white/80 text-center mt-1">
                  <p className="mb-1">New account level unlocked!</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="flex items-center gap-1">
                      <Target size={14} className="text-gray-500 dark:text-gray-300" />
                      {accountLevel.totalActivitiesLogged}
                    </span>
                    <span className="flex items-center gap-1">
                      <Sprout size={14} className="text-lime-600 dark:text-lime-400" />
                      {accountLevel.habitCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Rocket size={14} className="text-orange-500 dark:text-orange-400" />
                      {accountLevel.lifestyleCount}
                    </span>
                  </div>
                </div>
              )}
              {/* Message */}
              {achievementPost.message && (
                <p className="text-xs text-gray-600 dark:text-white/70 text-center mt-1 italic">
                  "{achievementPost.message}"
                </p>
              )}
              <p
                onClick={(e) => {
                  e.stopPropagation();
                  onUsernameClick?.();
                }}
                className="text-sm text-gray-800 dark:text-white/90 text-center mt-2 cursor-pointer hover:underline font-medium"
              >
                @{achievementPost.user.username}
              </p>
            </div>

            {/* Emoji picker button - centered below card */}
            <div className="mt-2">
              <ReactionPicker
                show={showEmojiPicker}
                onToggle={() => setShowEmojiPicker(!showEmojiPicker)}
                onSelect={handleReactionClick}
                variant="overlay"
              />
            </div>
          </div>
        </div>

        {/* Reactions on the sides */}
        {reactions && Object.keys(reactions).length > 0 && (
          <>
            {/* Left side reactions (first 4 or all if ≤4) */}
            <div className="absolute left-1 bottom-16 z-20 flex flex-col gap-2">
              <ReactionsList
                reactions={Object.fromEntries(
                  Object.entries(reactions).slice(0, 4)
                )}
                currentUsername={currentUserUsername || undefined}
                onReactionClick={handleReactionClick}
                variant="overlay"
                vertical
              />
            </div>

            {/* Right side reactions (remaining if >4) */}
            {Object.keys(reactions).length > 4 && (
              <div className="absolute right-1 bottom-16 z-20 flex flex-col gap-2">
                <ReactionsList
                  reactions={Object.fromEntries(
                    Object.entries(reactions).slice(4)
                  )}
                  currentUsername={currentUserUsername || undefined}
                  onReactionClick={handleReactionClick}
                  variant="overlay"
                  vertical
                />
              </div>
            )}
          </>
        )}

        {/* Comment input overlay at bottom - styled like ActivityEntryPhotoCard description */}
        {currentUser && (
          <div className="absolute -bottom-5 left-0 right-0 z-30">
            <div className="relative -mb-4 mx-2">
              <CommentSection
                achievementPostId={achievementPost.id}
                comments={[]} // Only show input here, comments will be below
                onAddComment={(text) => {
                  setReplyToUsername(undefined); // Clear reply after submitting
                  return addCommentToAchievement({
                    achievementPostId: achievementPost.id,
                    userUsername: achievementPost.user.username || "",
                    text,
                  });
                }}
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
                replyToUsername={replyToUsername}
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
            onReply={(username) => setReplyToUsername(username)}
          />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialogOrPopover
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDeleteClick?.();
        }}
        title="Delete Achievement Post"
        description="Are you sure you want to delete this achievement post? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Medal Explainer Popover for level-up achievements */}
      <MedalExplainerPopover
        open={showMedalExplainer}
        onClose={() => setShowMedalExplainer(false)}
        username={achievementPost.user.username || undefined}
      />

      {/* Edit Dialog */}
      <AchievementEditDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        achievementPostId={achievementPost.id}
        currentMessage={achievementPost.message || undefined}
        currentImages={userImages.filter((img) => img.url).map((img) => ({ id: img.id, url: img.url! }))}
        planEmoji={isLevelUp ? "🎖️" : achievementPost.plan?.emoji || undefined}
      />
    </div>
  );
};

export default AchievementPostCard;
