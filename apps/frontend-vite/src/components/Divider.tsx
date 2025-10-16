import React from "react";

interface DividerProps {
  text?: string;
  className?: string;
}

const Divider: React.FC<DividerProps> = ({ text, className }) => {
  return (
    <div className={`flex items-center my-4 ${className}`}>
      <div className="flex-grow h-[1px] bg-border" />
      {text && (
        <span className="px-4 text-sm text-muted-foreground">
          {text.toUpperCase()}
        </span>
      )}
      <div className="flex-grow h-[1px] bg-border" />
    </div>
  );
};

export default Divider;