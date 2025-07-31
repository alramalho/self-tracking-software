import React from "react";
import { Check, Lock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { VisibilityType } from "@/contexts/UserPlanContext";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useUpgrade } from "@/contexts/UpgradeContext";
import { cn } from "@/lib/utils";

export function toReadablePrivacySetting(privacySetting: VisibilityType) {
  switch (privacySetting) {
    case "public":
      return "Everyone";
    case "private":
      return "Only me";
    case "friends":
      return "Only Friends";
  }
}

interface ActivityPrivacyDropdownProps {
  value: VisibilityType;
  onChange: (value: VisibilityType) => void;
  className?: string;
}

const ActivityPrivacyDropdown: React.FC<ActivityPrivacyDropdownProps> = ({
  value,
  onChange,
  className,
}) => {
  const { userPaidPlanType } = usePaidPlan();
  const { setShowUpgradePopover } = useUpgrade();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleOptionClick = (option: VisibilityType) => {
    const isLocked = userPaidPlanType === "FREE" && (option === "friends" || option === "private");
    setIsOpen(false);
    if (isLocked) {
      setTimeout(() => setShowUpgradePopover(true), 100);
    } else {
      onChange(option);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger className={`p-2 px-3 border rounded-md ${className}`}>
        {toReadablePrivacySetting(value)}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {["public", "private", "friends"].map((option) => {
          const isLocked = userPaidPlanType === "FREE" && (option === "friends" || option === "private");
          return (
            <DropdownMenuItem
              key={option}
              onClick={() => handleOptionClick(option as VisibilityType)}
              className={cn(
                "flex items-center justify-between group",
                isLocked && "opacity-50 cursor-not-allowed"
              )}
            >
              <div>
                {toReadablePrivacySetting(option.toLowerCase() as VisibilityType)}
                {isLocked && (
                  <div className="text-xs text-gray-500">
                    Supporters only
                  </div>
                )}
              </div>
              {value.toLowerCase() === option ? (
                <Check className="w-4 h-4 ml-2" />
              ) : isLocked ? (
                <Lock className="w-4 h-4 ml-2" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ActivityPrivacyDropdown; 