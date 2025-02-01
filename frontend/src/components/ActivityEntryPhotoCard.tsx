import React, { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Smile } from "lucide-react";
import { ReactionBarSelector } from "@charkour/react-reactions";
import { useUserPlan } from "@/contexts/UserPlanContext";
import toast from "react-hot-toast";
import { useApiWithAuth } from "@/api";
import { parseISO, format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';

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
  isoDate,
  daysUntilExpiration,
  hasImageExpired,
  userPicture,
  userName,
  userUsername,
  editable,
  onAvatarClick,
  onEditClick,
  activityEntryId,
  description,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<ReactionCount>(
    activityEntryReactions
  );
  const { useUserDataQuery } = useUserPlan();
  const userData = useUserDataQuery("me").data;
  const currentUserUsername = userData?.user?.username;
  const isOwnActivityEntry = userData?.user?.username === userUsername;
  const api = useApiWithAuth();
  const [showUserList, setShowUserList] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowReadMore, setShouldShowReadMore] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseInt(window.getComputedStyle(textRef.current).lineHeight);
      const height = textRef.current.scrollHeight;
      const lines = height / lineHeight;
      setShouldShowReadMore(lines > 3);
    }
  }, [description]);

  // todo: use react query
  async function getReactions() {
    const response = await api.get(
      `/activity-entries/${activityEntryId}/reactions`
    );
    setReactions(response.data.reactions);
  }

  async function addReaction(emoji: string) {
    setShowEmojiPicker(false);

    await toast.promise(
      api.post(`/activity-entries/${activityEntryId}/reactions`, {
        operation: "add",
        emoji,
      }),
      {
        loading: "Adding reaction...",
        success: "Reaction added successfully!",
        error: "Failed to add reaction",
      }
    );

    getReactions();
  }
  async function removeReaction(emoji: string) {
    try {
      setShowEmojiPicker(false);

      await toast.promise(
        api.post(`/activity-entries/${activityEntryId}/reactions`, {
          operation: "remove",
          emoji,
        }),
        {
          loading: "Removing reaction...",
          success: "Reaction removed successfully!",
          error: "Failed to remove reaction",
        }
      );
    } catch (error) {
      toast.error("Failed to remove reaction");
    } finally {
      getReactions();
    }
  }

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
          await removeReaction(emoji);
        } else {
          setShowUserList((prev) => ({ ...prev, [emoji]: true }));
        }
      } else {
        await addReaction(emoji);
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
    <div className="bg-white border rounded-lg overflow-hidden relative">
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
                    className={`inline-flex items-center border border-gray-200 border-gray-100 rounded-full px-3 py-1.5 text-sm shadow-md transition-all gap-2 pointer-events-auto ${
                      usernames.includes(currentUserUsername || "")
                        ? "border-blue-400 bg-blue-50"
                        : "bg-white "
                    }`}
                  >
                    <span className="text-base">{emoji}</span>
                    {showUserList[emoji] ? (
                      <span className="text-gray-600 font-medium">
                        {formatUserList(usernames)}
                      </span>
                    ) : (
                      <span className="text-gray-600 font-medium">
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
                        backgroundColor: "#f7f7f7",
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
                      className={`inline-flex items-center space-x-1 bg-white rounded-full p-2 transition-all shadow-md`}
                    >
                      <Smile className={`h-6 w-6 text-gray-500`} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {hasImage && description && (
            <div className="relative -mt-6 mx-2">
              <div className="relative rounded-2xl overflow-hidden bg-white/20 backdrop-blur-lg shadow-lg border border-white/20 p-4">
                <div className={`relative ${!isExpanded && 'max-h-[4.5em]'} ${shouldShowReadMore && !isExpanded && 'overflow-hidden'}`}>
                  <p ref={textRef} className="text-gray-800 font-medium text-sm relative z-10">
                    {description}
                  </p>
                  {shouldShowReadMore && !isExpanded && (
                    <div className="absolute bottom-0 right-0 left-0 h-6 bg-gradient-to-t from-white/80 to-transparent" />
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
            <Avatar className="w-8 h-8" onClick={onAvatarClick}>
              <AvatarImage src={userPicture} alt={userName || ""} />
              <AvatarFallback>{(userName || "U")[0]}</AvatarFallback>
            </Avatar>
            <span className="text-5xl h-full text-gray-400">
              {activityEmoji}
            </span>
            <div className="flex flex-col">
              <span className="text-sm text-gray-500">@{userUsername}</span>
              <span className="font-semibold">
                {activityTitle} – {activityEntryQuantity} {activityMeasure}
              </span>
              <span className="text-xs text-gray-500">
                {getFormattedDate(isoDate)}
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
              <div className="absolute bottom-0 right-0 left-0 h-6 bg-gradient-to-t from-white to-transparent" />
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
