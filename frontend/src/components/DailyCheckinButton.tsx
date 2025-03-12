import React from "react";
import { useDailyCheckinPopover } from "@/contexts/DailyCheckinContext";
import { Button } from "./ui/button";
import { ScanFace } from "lucide-react";

interface DailyCheckinButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const DailyCheckinButton: React.FC<DailyCheckinButtonProps> = ({
  variant = "outline",
  size = "default",
  className,
}) => {
  const { setShowDailyCheckinPopover, wasSubmittedToday } = useDailyCheckinPopover();

  return (
    <Button
      variant={wasSubmittedToday ? variant : "destructive"}
      size={size}
      className={className}
      onClick={() => setShowDailyCheckinPopover(true)}
    >
      <ScanFace className="mr-2" size={16} />
      Daily Check-in
      {!wasSubmittedToday && <span className="ml-1 text-xs">!</span>}
    </Button>
  );
}; 