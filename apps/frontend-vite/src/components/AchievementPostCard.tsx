import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useActivities } from "@/contexts/activities/useActivities";
import { useTheme } from "@/contexts/theme/useTheme";
import { useCurrentUser } from "@/contexts/users";
import { useAccountLevel } from "@/hooks/useAccountLevel";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { ReactionBarSelector } from "@charkour/react-reactions";
import { type PlanType } from "@tsw/prisma";
import {
  differenceInCalendarDays,
  format,
  isToday,
  isYesterday,
} from "date-fns";
import { Smile } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { type TimelineAchievementPost } from "@/contexts/timeline/service";
import CommentSection from "./CommentSection";
import { ProgressRing } from "./ProgressRing";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

const REACTION_EMOJI_MAPPING = {
  fire: "🔥",
  rocket: "🚀",
  love: "♥️",
  laugh: "😂",
  oof: "😮‍💨",
  peach: "🍑",
  surprise: "😮",
};

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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
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
  const images = achievementPost.images || [];
  const hasImages = images.length > 0;

  const {
    modifyReactionsOnAchievement,
    isModifyingReactions,
    addCommentToAchievement,
    removeCommentFromAchievement,
    isAddingComment,
    isRemovingComment,
  } = useActivities();

  const comments = achievementPost.comments || [];

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

  const formatUserList = (usernames: string[]) => {
    if (usernames.length === 1) return usernames[0];
    if (usernames.length === 2) return usernames.join(" and ");
    return `${usernames.slice(0, -1).join(", ")}, and ${usernames[usernames.length - 1]}`;
  };

  const achievementEmojis = getAchievementEmojis(achievementPost.achievementType);
  const achievementTitle = getAchievementTitle(
    achievementPost.achievementType,
    achievementPost.streakNumber
  );

  const goToNextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const goToPrevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

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

      {/* Images */}
      {hasImages && (
        <div className="relative">
          <div className="relative rounded-2xl overflow-hidden mx-4 mb-2">
            <img
              src={images[currentImageIndex].url || ""}
              alt={`Achievement ${currentImageIndex + 1}`}
              className="w-full h-full max-h-[400px] object-cover rounded-2xl"
            />

            {/* Description overlay on image */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 via-black/50 to-transparent backdrop-blur-md">
              <p className="text-sm text-white font-medium text-center mb-1">
                {achievementPost.plan.goal}
              </p>
              {achievementPost.message && (
                <p className="text-xs text-white/90 text-center">
                  {achievementPost.message}
                </p>
              )}
            </div>

            {/* Image navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={goToPrevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={goToNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                  {images.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full ${
                        idx === currentImageIndex
                          ? "bg-white"
                          : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Reactions overlay */}
            <div className="absolute top-2 left-2 flex flex-col flex-nowrap items-start gap-2 z-30">
              {reactions &&
                Object.entries(reactions).map(([emoji, usernames]) => {
                  return (
                    <button
                      key={emoji}
                      onClick={() => handleReactionClick(emoji)}
                      className={`inline-flex border border-white/20 backdrop-blur-sm items-center rounded-full px-3 py-1.5 text-sm shadow-md transition-all gap-2 ${
                        usernames.includes(currentUserUsername || "")
                          ? variants.card.selected.glassBg
                          : variants.card.glassBg
                      }`}
                    >
                      <span className="text-base">{emoji}</span>
                      <span className="text-foreground font-medium">
                        {usernames.length}
                      </span>
                    </button>
                  );
                })}
            </div>

            {/* Emoji picker button */}
            {!isOwnPost && (
              <div className="absolute bottom-2 right-2 z-30">
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
            )}
          </div>

          {/* Comment section */}
          <div className="mx-4 mb-2">
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
              hasImage={true}
              showAllComments={showAllComments}
              onToggleShowAll={setShowAllComments}
              isAddingComment={isAddingComment}
              isRemovingComment={isRemovingComment}
            />
          </div>
        </div>
      )}

      {/* No images case - just show reactions and comments below */}
      {!hasImages && (
        <div className="px-4 pb-4">
          {/* Plan goal and message when no images */}
          <div className="mb-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {achievementPost.plan.goal}
            </p>
            {achievementPost.message && (
              <p className="text-sm text-foreground">
                {achievementPost.message}
              </p>
            )}
          </div>

          {/* Reactions */}
          {reactions && Object.keys(reactions).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(reactions).map(([emoji, usernames]) => (
                <button
                  key={emoji}
                  onClick={() => handleReactionClick(emoji)}
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm transition-all gap-2 ${
                    usernames.includes(currentUserUsername || "")
                      ? variants.card.selected.bg
                      : variants.card.bg
                  }`}
                >
                  <span className="text-base">{emoji}</span>
                  <span className="text-foreground font-medium">
                    {usernames.length}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Emoji picker */}
          {!isOwnPost && (
            <div className="mb-3">
              {showEmojiPicker ? (
                <ReactionBarSelector
                  iconSize={24}
                  style={{
                    border: `1px solid rgba(128, 128, 128, 0.2)`,
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
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1"
                >
                  <Smile className="h-4 w-4" />
                  Add reaction
                </button>
              )}
            </div>
          )}

          {/* Comments */}
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
            hasImage={false}
            showAllComments={showAllComments}
            onToggleShowAll={setShowAllComments}
            isAddingComment={isAddingComment}
            isRemovingComment={isRemovingComment}
          />
        </div>
      )}
    </div>
  );
};

export default AchievementPostCard;
