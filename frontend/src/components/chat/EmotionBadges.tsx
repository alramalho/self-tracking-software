import React from 'react';

export interface Emotion {
  name: string;
  score: number;
  color: string;
}

export const EmotionBadges = ({ emotions }: { emotions: Emotion[] }) => {
  return (
    <div className="flex items-center max-w-full gap-2 overflow-x-auto no-scrollbar w-full justify-center py-4">
      <div className="flex overflow-x-auto no-scrollbar gap-2 px-4">
        {emotions.map((emotion, index) => (
          <div
            key={index}
            style={{
              color: `${emotion.color}`,
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