import { Emotion } from '@/contexts/UserPlanContext';
import React from 'react';

export const EmotionBadges = ({ emotions }: { emotions: Emotion[] }) => {
  // Helper function to determine if a color is bright
  const isBrightColor = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  };

  // Helper function to darken a color
  const darkenColor = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Reduce each component by 40%
    const darkerR = Math.floor(r * 0.6);
    const darkerG = Math.floor(g * 0.6);
    const darkerB = Math.floor(b * 0.6);
    
    return `#${darkerR.toString(16).padStart(2, '0')}${darkerG.toString(16).padStart(2, '0')}${darkerB.toString(16).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center max-w-full gap-2 overflow-x-auto no-scrollbar w-full justify-center py-4">
      <div className="flex overflow-x-auto no-scrollbar gap-2 px-4">
        {emotions.map((emotion, index) => (
          <div
            key={index}
            style={{
              color: isBrightColor(emotion.color) ? darkenColor(emotion.color) : emotion.color,
              backgroundColor: `${emotion.color}15`,
              borderColor: emotion.color,
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-full border"
          >
            <span className="font-medium">{emotion.name}</span>
            <span className="text-xs opacity-75">
              {Math.round(emotion.score * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}; 