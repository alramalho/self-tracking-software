"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Message } from "@/contexts/UserPlanContext"
import { EmotionRadar } from "./EmotionRadar"

interface Emotion {
  name: string;
  score: number;
  color: string;
}

interface MessageWithEmotions extends Message {
  emotions?: Emotion[];
}

const EMOTION_TO_CATEGORY = {
    "Joy": "Optimism",
    "Excitement": "Optimism",
    "Interest": "Awe",
    "Surprise (positive)": "Awe",
    "Contentment": "Optimism",
    "Satisfaction": "Optimism",
    "Relief": "Optimism",
    "Admiration": "Awe",
    "Amusement": "Love",
    "Ecstasy": "Love",
    "Love": "Love",
    "Pride": "Optimism",
    "Triumph": "Optimism",
    "Realization": "Awe",
    "Aesthetic Appreciation": "Awe",
    "Adoration": "Love",
    "Calmness": "Optimism",
    "Concentration": "Submission",
    "Contemplation": "Awe",
    "Determination": "Optimism",
    "Desire": "Love",
    "Romance": "Love",
    "Nostalgia": "Remorse",
    "Entrancement": "Awe",
    "Awe": "Awe",
    "Anger": "Aggressiveness",
    "Anxiety": "Submission",
    "Fear": "Submission",
    "Sadness": "Remorse",
    "Disgust": "Disapproval",
    "Confusion": "Submission",
    "Contempt": "Contempt",
    "Disappointment": "Remorse",
    "Distress": "Remorse",
    "Embarrassment": "Submission",
    "Empathic Pain": "Remorse",
    "Pain": "Remorse",
    "Shame": "Remorse",
    "Surprise (negative)": "Awe",
    "Tiredness": "Remorse",
    "Awkwardness": "Disapproval",
    "Boredom": "Disapproval",
    "Doubt": "Submission",
    "Craving": "Love",
} as const;

interface EmotionViewerProps {
  messages: MessageWithEmotions[];
}

export function EmotionViewer({ messages }: EmotionViewerProps) {
  // Process messages to get emotion categories data
  const emotionCounts: { [key: string]: number } = {};
  let totalMessages = 0;

  messages.forEach(message => {
    if (message.emotions) {
      message.emotions.forEach(emotion => {
        const category = EMOTION_TO_CATEGORY[emotion.name as keyof typeof EMOTION_TO_CATEGORY] || "Other";
        emotionCounts[category] = (emotionCounts[category] || 0) + emotion.score;
      });
      totalMessages++;
    }
  });

  // Convert to chart data format and calculate averages
  const chartData = Object.entries(emotionCounts).map(([category, total]) => ({
    category,
    value: totalMessages > 0 ? (total / totalMessages) : 0,
  }));

  return (
    <Card>
      <CardHeader className="items-center pb-4">
        <CardTitle>Emotional Profile</CardTitle>
        <CardDescription>
          Analysis of emotional patterns in messages
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <EmotionRadar data={chartData} />
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          {totalMessages} messages analyzed
        </div>
        <div className="flex items-center gap-2 leading-none text-muted-foreground">
          Most prevalent: {chartData.sort((a, b) => b.value - a.value)[0]?.category}
        </div>
      </CardFooter>
    </Card>
  )
}