import React from "react";

interface DividerProps {
  text?: string;
}

const Divider: React.FC<DividerProps> = ({ text }) => {
  return (
    <div className="flex items-center my-4">
      <div className="flex-grow h-[1px] bg-gray-200" />
      {text && (
        <span className="px-4 text-sm text-gray-500">
          {text}
        </span>
      )}
      <div className="flex-grow h-[1px] bg-gray-200" />
    </div>
  );
};

export default Divider;