import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Image, Slack, Smile } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import { ReactionBarSelector, ReactionCounterObject, SlackCounter } from "@charkour/react-reactions";
import { EmojiClickData, } from "emoji-picker-react";

interface ActivityEntryPhotoCardProps {
  imageUrl?: string;
  activityTitle: string;
  activityEntryQuantity: number;
  activityMeasure: string;
  activityEmoji: string;
  formattedDate: string;
  daysUntilExpiration: number;
  hasImageExpired?: boolean;
  userPicture?: string;
  userName?: string;
  userUsername?: string;
  editable?: boolean;
  onEditClick?: () => void;
  onClick?: () => void;
}

interface ReactionCount {
  [key: string]: {usernames: string[]};
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
  formattedDate,
  daysUntilExpiration,
  hasImageExpired,
  userPicture,
  userName,
  userUsername,
  editable,
  onClick,
  onEditClick,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<ReactionCount>({});

  const handleEmojiClick = (emojiName: string) => {
    const emoji = REACTION_EMOJI_MAPPING[emojiName as keyof typeof REACTION_EMOJI_MAPPING];
    if (reactions[emoji]?.usernames.includes(userUsername!)) {
      return;
    }
    setReactions((prev) => {
      const newReactions = { ...prev };
      newReactions[emoji] = {
        usernames: [...(newReactions[emoji]?.usernames || []), userUsername!],
      };
      return newReactions;
    });
    setShowEmojiPicker(false);
  };

  return (
    <div
      className="border rounded-lg overflow-hidden relative"
      onClick={onClick}
    >
      {imageUrl && !hasImageExpired && (
        <div className="relative max-h-full max-w-full mx-auto">
          <img
            src={imageUrl}
            alt={activityTitle}
            className="w-full h-full max-h-[400px] object-contain"
          />
          <div className="absolute top-2 left-2 flex flex-col flex-nowrap items-start gap-2">
            {Object.entries(reactions).map(([emoji, {usernames}]) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  const reactionUsernames = reactions[emoji]?.usernames || [];
                  if (reactionUsernames.includes(userUsername!)) {
                    return;
                  }
                  setReactions((prev) => ({
                    ...prev,
                    [emoji]: {
                      usernames: [...prev[emoji].usernames, userUsername!],
                    },
                  }));
                }}
                className="bg-white inline-flex items-center border border-gray-200 border-gray-100 rounded-full px-3 py-1.5 text-sm shadow-md transition-all gap-2"
              >
                <span className="text-base">{emoji}</span>
                <span className="text-gray-600 font-medium">{usernames.length}</span>
              </button>
            ))}
          </div>
          {imageUrl && !hasImageExpired && (
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
                    onSelect={handleEmojiClick}
                  />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmojiPicker(!showEmojiPicker);
                    }}
                    className="inline-flex items-center space-x-1 bg-white rounded-full p-2 transition-all shadow-md"
                  >
                    <Smile className="h-6 w-6 text-gray-500" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      <div className="p-4 flex flex-row flex-nowrap items-center justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Avatar className="w-8 h-8">
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
