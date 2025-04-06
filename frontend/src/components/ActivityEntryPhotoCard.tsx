import React, { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Smile, BadgeCheck } from "lucide-react";
import { ReactionBarSelector } from "@charkour/react-reactions";
import { useUserPlan } from "@/contexts/UserPlanContext";
import toast from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import { parseISO, format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';
import { twMerge } from "tailwind-merge";
import { getThemeVariants } from "@/utils/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { PlanBadge } from "./PlanBadge";

const getFormattedDate = (date: string) => {
  const parsedDate = parseISO(date);
  const now = new Date();
  
  if (isToday(parsedDate)) {
    return `today at ${format(parsedDate, "HH:mm")}`;
  }
  
  if (isYesterday(parsedDate)) {
    return `yesterday at ${format(parsedDate, "HH:mm")}`;
  }
  
  const diffInCalendarDays = differenceInCalendarDays(now, parsedDate);
  
  if (diffInCalendarDays <= 7) {
    return `last ${format(parsedDate, "EEEE")} at ${format(parsedDate, "HH:mm")}`;
  }
  
  return format(parsedDate, "MMM d HH:mm");
};
interface ActivityEntryPhotoCardProps {
  imageUrl?: string;
  activityTitle: string;
  activityEntryQuantity: number;
  activityMeasure: string;
  activityEmoji: string;
  activityEntryTimezone?: string;
  activityEntryReactions: Record<string, string[]>;
  isoDate: string;
  daysUntilExpiration: number;
  hasImageExpired?: boolean;
  userPicture?: string;
  userName?: string;
  userUsername?: string;
  editable?: boolean;
  onEditClick?: () => void;
  onAvatarClick?: () => void;
  onUsernameClick?: () => void;
  activityEntryId: string;
  description?: string;
}

interface ReactionCount {
  [key: string]: string[];
}

const REACTION_EMOJI_MAPPING = {
  fire: "🔥",
  rocket: "🚀",
  love: "♥️",
  laugh: "😂",
  aubergine: "🍆",
  peach: "🍑",
  surprise: "😮",
};

const ActivityEntryPhotoCard: React.FC<ActivityEntryPhotoCardProps> = ({
  imageUrl,
  activityTitle,
  activityEntryQuantity,
  activityMeasure,
  activityEmoji,
  activityEntryReactions,
  activityEntryTimezone,
  isoDate,
  daysUntilExpiration,
  hasImageExpired,
  userPicture,
  userName,
  userUsername,
  editable,
  onAvatarClick,
  onEditClick,
  onUsernameClick,
  activityEntryId,
  description,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<ReactionCount>(
    activityEntryReactions
  );
  const { useCurrentUserDataQuery } = useUserPlan();
  const { data: userData } = useCurrentUserDataQuery();
  const currentUserUsername = userData?.user?.username;
  const isOwnActivityEntry = userData?.user?.username === userUsername;
  const api = useApiWithAuth(); 
  const { effectiveTheme } = useTheme();
  const variants = getThemeVariants(effectiveTheme);
  const [showUserList, setShowUserList] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowReadMore, setShouldShowReadMore] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  const { useUserPlanType } = usePaidPlan();
  const { data: userPlanType } = useUserPlanType(userUsername || "");

  const getPlanStyles = () => {
    if (userPlanType === "plus") {
      return {
        ringColor: "ring-blue-500",
        fillColor: "#3b82f6",
        textColor: "text-blue-500",
      };
    }
    return {
      ringColor: "",
      fillColor: "",
      textColor: "",
    };
  };

  const { ringColor, fillColor, textColor } = getPlanStyles();

  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseInt(window.getComputedStyle(textRef.current).lineHeight);
      const height = textRef.current.scrollHeight;
      const lines = height / lineHeight;
      setShouldShowReadMore(lines > 3);
    }
  }, [description]);

  // Add new state and refs for debounced reactions
  const pendingReactionsRef = useRef<{
    adds: Set<string>;
    removes: Set<string>;
    timer: NodeJS.Timeout | null;
  }>({
    adds: new Set<string>(),
    removes: new Set<string>(),
    timer: null,
  });

  // todo: use react query
  async function getReactions() {
    const response = await api.get(
      `/activity-entries/${activityEntryId}/reactions`
    );
    setReactions(response.data.reactions);
  }

  // Debounced method to process pending reactions
  const processPendingReactions = useCallback(async () => {
    console.log("processing pending reactions");
    const { adds, removes } = pendingReactionsRef.current;
    
    // Clear timer
    if (pendingReactionsRef.current.timer) {
      clearTimeout(pendingReactionsRef.current.timer);
      pendingReactionsRef.current.timer = null;
    }
    
    // Process adds if there are any
    if (adds.size > 0) {
      const emojisToAdd = Array.from(adds);
      adds.clear(); // Clear pending adds
      
      await toast.promise(
        api.post(`/activity-entries/${activityEntryId}/reactions`, {
          operation: "add",
          emojis: emojisToAdd,
        }),
        {
          loading: "Adding reactions...",
          success: "Reactions added successfully!",
          error: "Failed to add reactions",
        }
      );
    }
    
    // Process removes if there are any
    if (removes.size > 0) {
      const emojisToRemove = Array.from(removes);
      removes.clear(); // Clear pending removes
      
      await toast.promise(
        api.post(`/activity-entries/${activityEntryId}/reactions`, {
          operation: "remove",
          emojis: emojisToRemove,
        }),
        {
          loading: "Removing reactions...",
          success: "Reactions removed successfully!",
          error: "Failed to remove reactions",
        }
      );
    }
    
    // Refresh the reactions after processing
    getReactions();
  }, [activityEntryId, api]);

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

  // Queue a reaction instead of sending immediately
  const queueReaction = useCallback((emoji: string, operation: 'add' | 'remove') => {
    setShowEmojiPicker(false);
    
    console.log(`Queueing ${operation} reaction for emoji: ${emoji}`);
    
    // Add to the appropriate queue and schedule processing
    if (operation === 'add') {
      pendingReactionsRef.current.adds.add(emoji);
      // If this emoji is in the removes queue, remove it
      pendingReactionsRef.current.removes.delete(emoji);
    } else {
      pendingReactionsRef.current.removes.add(emoji);
      // If this emoji is in the adds queue, remove it
      pendingReactionsRef.current.adds.delete(emoji);
    }
    
    // Optimistically update UI for better UX
    setReactions(prevReactions => {
      const updatedReactions = { ...prevReactions };
      const username = currentUserUsername || "";
      
      if (operation === 'add') {
        if (!updatedReactions[emoji]) {
          updatedReactions[emoji] = [username];
        } else if (!updatedReactions[emoji].includes(username)) {
          updatedReactions[emoji] = [...updatedReactions[emoji], username];
        }
      } else {
        if (updatedReactions[emoji]) {
          updatedReactions[emoji] = updatedReactions[emoji].filter(name => name !== username);
          if (updatedReactions[emoji].length === 0) {
            delete updatedReactions[emoji];
          }
        }
      }
      
      return updatedReactions;
    });
    
    scheduleReactionProcessing();
  }, [currentUserUsername, scheduleReactionProcessing]);

  // Clean up timer on unmount and process any pending reactions
  useEffect(() => {
    return () => {
      if (pendingReactionsRef.current.timer) {
        clearTimeout(pendingReactionsRef.current.timer);
      }
      
      // If there are any pending reactions, process them immediately
      if (pendingReactionsRef.current.adds.size > 0 || pendingReactionsRef.current.removes.size > 0) {
        processPendingReactionsRef.current();
      }
    };
  }, []); // No dependencies since we're using refs

  // Replace original methods with queued versions 
  const addReaction = useCallback((emoji: string) => {
    queueReaction(emoji, 'add');
  }, [queueReaction]);
  
  const removeReaction = useCallback((emoji: string) => {
    queueReaction(emoji, 'remove');
  }, [queueReaction]);

  // own profile
  // numbers -> usernames -> numbers
  // not own profile
  // numbers -> add reaction (if not reacted) (goes back to numbers) -> list (if reacted) -> remove reaction.
  const handleReactionClick = async (emoji: string) => {
    if (isOwnActivityEntry) {
      setShowUserList((prev) => ({ ...prev, [emoji]: !prev[emoji] }));
    } else {
      const hasUserReacted = reactions[emoji]?.includes(
        currentUserUsername || ""
      );

      if (hasUserReacted) {
        if (showUserList[emoji]) {
          removeReaction(emoji);
        } else {
          setShowUserList((prev) => ({ ...prev, [emoji]: true }));
        }
      } else {
        addReaction(emoji);
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

  const hasImage = imageUrl && !hasImageExpired;

  return (
    <div className="bg-white/50 border rounded-lg overflow-hidden relative">
      {hasImage && (
        <div className="relative max-h-full max-w-full mx-auto p-4 pb-0">
          <div className="relative rounded-2xl overflow-hidden backdrop-blur-lg shadow-lg border border-white/20">
            <img
              src={imageUrl}
              alt={activityTitle}
              className="w-full h-full max-h-[400px] object-cover rounded-2xl"
            />
            <div className="absolute top-2 left-2 flex flex-col flex-nowrap items-start gap-2 z-30">
              {Object.entries(reactions).map(([emoji, usernames]) => {
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReactionClick(emoji)}
                    className={`inline-flex border  border-white/20 backdrop-blur-sm items-center rounded-full px-3 py-1.5 text-sm shadow-md transition-all gap-2 pointer-events-auto ${
                      usernames.includes(currentUserUsername || "")
                        ? variants.card.selected.glassBg
                        : variants.card.glassBg
                    }`}
                  >
                    <span className="text-base">{emoji}</span>
                    {showUserList[emoji] ? (
                      <span className="text-gray-800 font-medium">
                        {formatUserList(usernames)}
                      </span>
                    ) : (
                      <span className="text-gray-800 font-medium">
                        {usernames.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {hasImage && !isOwnActivityEntry && (
              <>
                <div className={`absolute bottom-0 right-2 z-30 ${description ? 'mb-8' : 'mb-2'}`}>
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
                      onSelect={(key) =>
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
                      <Smile className={`h-6 w-6 text-gray-800`} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {hasImage && description && (
            <div className="relative -mt-6 mx-2">
              <div className={`relative rounded-2xl overflow-hidden ${variants.card.glassBg} backdrop-blur-lg shadow-lg border border-white/20 p-4`}>
                <div className={`relative ${!isExpanded && 'max-h-[4.5em]'} ${shouldShowReadMore && !isExpanded && 'overflow-hidden'}`}>
                  <p ref={textRef} className="text-gray-800 font-medium text-sm relative z-10">
                    {description}
                  </p>
                  {shouldShowReadMore && !isExpanded && (
                    <div className="absolute bottom-0 right-0 left-0 h-6" />
                  )}
                </div>
                {shouldShowReadMore && (
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-gray-500 underline text-xs font-medium mt-1"
                  >
                    {isExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="p-4 flex flex-col flex-nowrap items-start justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Avatar 
                className={twMerge(
                  "w-8 h-8",
                  userPlanType !== "free" && "ring-2 ring-offset-2 ring-offset-white",
                  userPlanType !== "free" && variants.ring
                )} 
                onClick={onAvatarClick}
              >
                <AvatarImage src={userPicture} alt={userName || ""} />
                <AvatarFallback>{(userName || "U")[0]}</AvatarFallback>
              </Avatar>
              {userPlanType && userPlanType !== "free" && (
                <div className="absolute -bottom-[6px] -right-[6px]">
                  <PlanBadge planType={userPlanType} size={18} />
                </div>
              )}
            </div>
            <span className="text-5xl h-full text-gray-400">
              {activityEmoji}
            </span>
            <div className="flex flex-col">
              <span 
                className="text-sm text-gray-500 hover:underline cursor-pointer" 
                onClick={onUsernameClick}
              >
                @{userUsername}
              </span>
              <span className="font-semibold">
                {activityTitle} – {activityEntryQuantity} {activityMeasure}
              </span>
              <span className="text-xs text-gray-500">
                {getFormattedDate(isoDate)} {activityEntryTimezone && `– 📍 ${activityEntryTimezone}`}
              </span>
            </div>
          </div>
        </div>
        {!hasImage && description && (
          <div className={`mt-3 ${!isExpanded && 'max-h-[4.5em]'} ${shouldShowReadMore && !isExpanded && 'overflow-hidden'} relative`}>
            <p ref={textRef} className="text-gray-700 text-sm">
              {description}
            </p>
            {shouldShowReadMore && !isExpanded && (
              <div className="absolute bottom-0 right-0 left-0 h-6" />
            )}
            {shouldShowReadMore && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-blue-500 text-xs font-medium mt-1 hover:text-blue-600"
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}

        {hasImage && (
          <span className="text-xs text-gray-400 mt-2">
            Image expires{" "}
            {daysUntilExpiration > 0
              ? `in ${daysUntilExpiration} days`
              : "today"}
          </span>
        )}
        <div>
          {editable && onEditClick && (
            <button
              onClick={onEditClick}
              className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
            >
              <Edit className="h-4 w-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityEntryPhotoCard;
