import React from "react";
import { cn } from "@/lib/utils";

interface NumberProps {
  children: React.ReactNode;
  className?: string;
}

const Number: React.FC<NumberProps> = ({ children, className }) => (
  <span
    className={cn(
      "flex flex-shrink-0 items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium",
      className
    )}
  >
    {children}
  </span>
);

export default Number; 