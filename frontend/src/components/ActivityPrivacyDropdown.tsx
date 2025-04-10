import React from "react";
import { Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { VisibilityType } from "@/contexts/UserPlanContext";

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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={`p-2 px-3 border rounded-md ${className}`}>
        {toReadablePrivacySetting(value)}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {["public", "private", "friends"].map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => onChange(option as VisibilityType)}
            className="flex items-center justify-between"
          >
            {toReadablePrivacySetting(option.toLowerCase() as VisibilityType)}
            {value.toLowerCase() === option && (
              <Check className="w-4 h-4 ml-2" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ActivityPrivacyDropdown; 