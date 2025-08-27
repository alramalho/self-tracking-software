import React from 'react';
import { RefreshCw } from 'lucide-react'; // Using lucide-react for the refresh icon

interface RefreshIconProps {
  isVisible: boolean;
  scrollPercentage: number; // 0 to 1
}

const RefreshIcon: React.FC<RefreshIconProps> = ({ isVisible, scrollPercentage }) => {
  if (!isVisible) {
    return null;
  }

  const rotation = scrollPercentage * 360; // Icon rotates 360 degrees as percentage goes 0 to 1

  return (
    <div
      className="fixed top-10 left-1/2 -translate-x-1/2 z-50 p-3 bg-gray-700 bg-opacity-50 text-white rounded-full shadow-lg transition-opacity duration-300 ease-in-out"
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      <RefreshCw
        size={28}
        style={{ transform: `rotate(${rotation}deg)` }}
        className="transition-transform duration-100 ease-linear"
      />
    </div>
  );
};

export default RefreshIcon; 