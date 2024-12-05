import React from 'react';

export interface Emotion {
  name: string;
  score: number;
  color: string;
}

interface EmotionBadgesProps {
  emotions: Emotion[];
}

export const EmotionBadges: React.FC<EmotionBadgesProps> = ({ emotions }) => {
  if (!emotions.length) return null;

  return (
    <div className="flex gap-2 mt-2 justify-center">
      {emotions.map((emotion, index) => (
        <div
          key={index}
          className="px-2 py-1 rounded-full text-xs font-medium"
          style={{
            backgroundColor: `${emotion.color}15`,
            color: emotion.color,
            border: `1px solid ${emotion.color}30`,
          }}
        >
          {emotion.name} {(emotion.score * 100).toFixed(0)}%
        </div>
      ))}
    </div>
  );
}; 