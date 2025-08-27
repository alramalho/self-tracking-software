import { LucideIcon } from "lucide-react";
import React from "react";

interface NeumorphicIconProps {
  icon: LucideIcon;
  isLoading?: boolean;
  badge?: number;
}

const NeumorphicIcon = ({ icon: Icon, isLoading, badge }: NeumorphicIconProps) => {
  const LoaderIcon = require("lucide-react").Loader2;

  return (
    <div className="p-2 rounded-xl bg-gray-100 shadow-[inset_-2px_-2px_5px_rgba(255,255,255,0.7),inset_2px_2px_5px_rgba(70,70,70,0.12)] 
                    group-hover:shadow-[inset_-1px_-1px_3px_rgba(255,255,255,0.7),inset_1px_1px_3px_rgba(70,70,70,0.12)]
                    transition-shadow duration-200 relative">
      {isLoading ? <LoaderIcon size={24} className="animate-spin" /> : <Icon size={24} />}
      {badge && badge > 0 && (
        <div className="absolute top-1 right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-white text-[14px] font-bold -mt-1 -mr-1">
          {badge > 99 ? '99+' : badge}
        </div>
      )}
    </div>
  );
};

export default NeumorphicIcon; 