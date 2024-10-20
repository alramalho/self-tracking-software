import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Image } from "lucide-react";

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
  onClick,
}) => {
  if (daysUntilExpiration < 0) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden" onClick={onClick}>
      {imageUrl && (
        <div className="max-h-full max-w-full mx-auto">
          <img
            src={imageUrl}
            alt={activityTitle}
            className="w-full h-full max-h-[400px] object-contain"
          />
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <Image className="w-1/2 h-1/2" />
          </div>
        </div>
      )}
      <div className="p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Avatar className="w-10 h-10">
              <AvatarImage src={userPicture} alt={userName || ""} />
              <AvatarFallback>{(userName || "U")[0]}</AvatarFallback>
            </Avatar>
            <span className="text-6xl h-full text-gray-400">
              {activityEmoji}
            </span>
            <div className="flex flex-col">
              <span className="text-md text-gray-500">@{userUsername}</span>
              <span className="font-semibold">
                {activityTitle} – {activityEntryQuantity} {activityMeasure}
              </span>
            </div>
          </div>
          <span className="text-sm text-gray-500">{formattedDate}</span>
        </div>
        <span className="text-xs text-gray-400">
          Image expires in {daysUntilExpiration} days
        </span>
      </div>
    </div>
  );
};

export default ActivityEntryPhotoCard;
