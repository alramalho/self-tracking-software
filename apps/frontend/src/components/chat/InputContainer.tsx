import React from "react";
import { cn } from "@/lib/utils";

interface InputContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const InputContainer: React.FC<InputContainerProps> = ({
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        "border-[4px] bg-white shadow-inner rounded-full border-gray-700",
        "w-full max-w-[600px] min-w-[220px] min-h-[4rem]",
        "flex items-center justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}; 