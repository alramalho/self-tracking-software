import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit, Image } from "lucide-react";

interface ActivityEntryPhotoCardProps {
  imageUrl?: string;
  activityTitle: string;
  activityEntryQuantity: number;
  activityMeasure: string;
  activityEmoji: string;
  formattedDate: string;
  daysUntilExpiration: number;
  userPicture?: string;
  userName?: string;
  userUsername?: string;
  editable?: boolean;
  onEditClick?: () => void;
  onClick?: () => void;
}

const ActivityEntryPhotoCard: React.FC<ActivityEntryPhotoCardProps> = ({
  imageUrl,
  activityTitle,
  activityEntryQuantity,
  activityMeasure,
  activityEmoji,
  formattedDate,
  daysUntilExpiration,
  userPicture,
  userName,
  userUsername,
  editable,
  onClick,
  onEditClick,
}) => {
  if (daysUntilExpiration < 0) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden relative" onClick={onClick}>
      {imageUrl && (
        <div className="max-h-full max-w-full mx-auto">
          <img
            src={imageUrl}
            alt={activityTitle}
            className="w-full h-full max-h-[400px] object-contain"
          />
        </div>
      )}
      <div className="p-4 flex flex-col">
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
        {imageUrl && (
          <span className="text-xs text-gray-400 mt-2">
            Image expires{" "}
            {daysUntilExpiration > 0 ? `in ${daysUntilExpiration} days` : "today"}
          </span>
        )} 
      </div>
      {editable && onEditClick && (
        <button onClick={onEditClick} className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100">
          <Edit className="h-4 w-4 text-gray-500" />
        </button>
      )}
    </div>
  );
};

export default ActivityEntryPhotoCard;
