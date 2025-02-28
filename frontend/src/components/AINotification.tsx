import React from "react";
import { ArrowRight, Reply, ScanFace, X } from "lucide-react";
import { Remark } from "react-remark";
import { Badge } from "./ui/badge";
import { formatTimeAgo } from "@/lib/utils";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";

interface AINotificationProps {
  message: string;
  createdAt: string;
  onDismiss: (e: React.MouseEvent) => void;
  onClick: () => void;
}

const AINotification: React.FC<AINotificationProps> = ({
  message,
  createdAt,
  onDismiss,
  onClick,
}) => {
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);

  return (
    <div
      className={`relative bg-opacity-50 p-2 backdrop-blur-sm rounded-2xl flex items-start mb-2 cursor-pointer`}
      onClick={onClick}
    >
      <div className="self-end flex-shrink-0 mr-2 relative">
        <div className="rounded-full">
          <ScanFace className={`w-12 h-12 ${variants.text}`} />
        </div>
        {/* <span className="absolute bottom-[-5px] left-[-15px] px-2 rounded-full text-white text-2xl">
          👋
        </span> */}
      </div>
      <div className="flex-grow">
        <div className="p-2 markdown text-sm text-gray-700 border border-gray-200 rounded-t-lg rounded-tr-lg rounded-br-lg bg-white">
          <Remark>{message}</Remark>
        </div>
        <div className="flex flex-row justify-between">
          <div className="text-xs text-gray-500 mt-1">
            {formatTimeAgo(createdAt)}
          </div>
          <div className="flex flex-row items-center gap-1 underline text-gray-500">
            <Reply size={15} />
            <span className="text-xs">Reply</span>
          </div>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="absolute top-1 right-1 p-[3px] rounded-full bg-gray-500"
        aria-label="Dismiss"
      >
        <X size={15} className="text-white" />
      </button>
    </div>
  );
};

export default AINotification;
