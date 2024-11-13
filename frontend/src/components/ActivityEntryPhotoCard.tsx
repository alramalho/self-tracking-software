import React, { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Smile } from "lucide-react";
import { ReactionBarSelector } from "@charkour/react-reactions";
import { useUserPlan } from "@/contexts/UserPlanContext";
import axios from "axios";
import toast from "react-hot-toast";
import { useApiWithAuth } from "@/api";
interface ActivityEntryPhotoCardProps {
  imageUrl?: string;
  activityTitle: string;
  activityEntryQuantity: number;
  activityMeasure: string;
  activityEmoji: string;
  activityEntryReactions: Record<string, string[]>;
  formattedDate: string;
  daysUntilExpiration: number;
  hasImageExpired?: boolean;
  userPicture?: string;
  userName?: string;
  userUsername?: string;
  editable?: boolean;
  onEditClick?: () => void;
  onAvatarClick?: () => void;
  activityEntryId: string;
}

interface ReactionCount {
    [key: string]: string[];
}

const REACTION_EMOJI_MAPPING = {
  fire: "🔥",
  rocket: "🚀",
  laugh: "😂",
  tada: "❓",
  poo: "💩",
};

const ActivityEntryPhotoCard: React.FC<ActivityEntryPhotoCardProps> = ({
  imageUrl,
  activityTitle,
  activityEntryQuantity,
  activityMeasure,
  activityEmoji,
  activityEntryReactions,
  formattedDate,
  daysUntilExpiration,
  hasImageExpired,
  userPicture,
  userName,
  userUsername,
  editable,
  onAvatarClick,
  onEditClick,
  activityEntryId,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<ReactionCount>(activityEntryReactions);
  const { useUserDataQuery } = useUserPlan();
  const userData = useUserDataQuery("me").data;
  const currentUserUsername = userData?.user?.username;
  const [isLoading, setIsLoading] = useState(false);
  const isOwnActivityEntry = userData?.user?.username === userUsername;
  const api = useApiWithAuth();
  const [showUserList, setShowUserList] = useState<{ [key: string]: boolean }>(
    {}
  );

  console.log(reactions);

  // todo: use react query
  async function getReactions() {
    const response = await api.get(
      `/activity-entries/${activityEntryId}/reactions`
    );
    setReactions(response.data.reactions);
  }

  async function addReaction(emoji: string) {
    try {
      setIsLoading(true);
      setShowEmojiPicker(false);

      await api.post(`/activity-entries/${activityEntryId}/reactions`, {
        operation: "add",
        emoji,
      });
    } catch (error) {
      toast.error("Failed to add reaction");
    } finally {
      setIsLoading(false);
      getReactions();
    }
  }

  async function removeReaction(emoji: string) {
    try {
      setIsLoading(true);
      setShowEmojiPicker(false);

      await api.post(`/activity-entries/${activityEntryId}/reactions`, {
        operation: "remove",
        emoji,
      });
    } catch (error) {
      toast.error("Failed to remove reaction");
    } finally {
      setIsLoading(false);
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

  return (
    <div
      className="border rounded-lg overflow-hidden relative"
    >
      {imageUrl && !hasImageExpired && (
        <div className="relative max-h-full max-w-full mx-auto">
          <img
            src={imageUrl}
            alt={activityTitle}
            className="w-full h-full max-h-[400px] object-contain"
          />
          <div className="absolute top-2 left-2 flex flex-col flex-nowrap items-start gap-2">
            {Object.entries(reactions).map(([emoji, usernames]) => {
              console.log(activityEntryId, emoji, usernames);
              return (
                <button
                  key={emoji}
                  onClick={() => handleReactionClick(emoji)}
                  className="bg-white inline-flex items-center border border-gray-200 border-gray-100 rounded-full px-3 py-1.5 text-sm shadow-md transition-all gap-2 pointer-events-auto"
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
              )
            })}
          </div>
          {imageUrl && !hasImageExpired && !isOwnActivityEntry && (
            <>
              <div className="absolute bottom-0 right-2">
                {showEmojiPicker ? (
                  <ReactionBarSelector
                    iconSize={24}
                    style={{
                      backgroundColor: "#f7f7f7",
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
                      console.log("clicked");
                      setShowEmojiPicker(!showEmojiPicker);
                    }}
                    className="inline-flex items-center space-x-1 bg-white rounded-full p-2 transition-all shadow-md"
                  >
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 text-gray-500 animate-spin" />
                    ) : (
                      <Smile className="h-6 w-6 text-gray-500" />
                    )}
                  </button>
                )}
              </div>
            </>
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
              <span className="text-xs text-gray-500">{formattedDate}</span>
            </div>
          </div>
        </div>
        {imageUrl && !hasImageExpired && (
          <span className="text-xs text-gray-400 mt-2">
            Image expires{" "}
            {daysUntilExpiration > 0
              ? `in ${daysUntilExpiration} days`
              : "today"}
          </span>
        )}
        <div>
          {/* {editable && onEditClick && (
            <button
              onClick={onEditClick}
              className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
            >
              <Edit className="h-4 w-4 text-gray-500" />
            </button>
          )} */}
        </div>
      </div>
    </div>
  );
};

export default ActivityEntryPhotoCard;
