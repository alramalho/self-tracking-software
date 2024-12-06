"use client";

import { Message } from "@/contexts/UserPlanContext";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

interface Emotion {
  name: string;
  score: number;
  color: string;
}

interface MessageWithEmotions extends Message {
  emotions: Emotion[];
}

const EMOTION_TO_SENTIMENT = {
  "Joy": "positive",
  "Excitement": "positive",
  "Interest": "positive",
  "Surprise (positive)": "positive",
  "Contentment": "positive",
  "Satisfaction": "positive",
  "Relief": "positive",
  "Admiration": "positive",
  "Amusement": "positive",
  "Ecstasy": "positive",
  "Love": "positive",
  "Pride": "positive",
  "Triumph": "positive",
  "Realization": "positive",
  "Aesthetic Appreciation": "positive",
  "Adoration": "positive",
  "Calmness": "positive",
  "Concentration": "neutral",
  "Contemplation": "neutral",
  "Determination": "neutral",
  "Desire": "positive",
  "Romance": "positive",
  "Nostalgia": "neutral",
  "Entrancement": "positive",
  "Awe": "neutral",
  "Anger": "negative",
  "Anxiety": "negative",
  "Fear": "negative",
  "Sadness": "negative",
  "Disgust": "negative",
  "Confusion": "neutral",
  "Contempt": "negative",
  "Disappointment": "negative",
  "Distress": "negative",
  "Embarrassment": "negative",
  "Empathic Pain": "negative",
  "Pain": "negative",
  "Shame": "negative",
  "Surprise (negative)": "negative",
  "Tiredness": "neutral",
  "Awkwardness": "negative",
  "Boredom": "neutral",
  "Doubt": "neutral",
  "Craving": "neutral",
} as const;

interface EmotionAreaChartViewerProps {
  messages: MessageWithEmotions[];
}

export function EmotionAreaChartViewer({ messages }: EmotionAreaChartViewerProps) {
  // Process messages to calculate normalized sentiment scores by date
  const chartData = messages
    .filter(msg => msg.emotions && msg.emotions.length > 0 && msg.created_at)
    .map(message => {
      let positiveCount = 0;
      let negativeCount = 0;
      let neutralCount = 0;

      message.emotions.forEach(emotion => {
        const sentiment = EMOTION_TO_SENTIMENT[emotion.name as keyof typeof EMOTION_TO_SENTIMENT];
        if (sentiment === "positive") positiveCount++;
        else if (sentiment === "negative") negativeCount--;
        else neutralCount++;
      });

      // Calculate normalized sentiment score between -1 and 1
      const totalEmotions = Math.abs(positiveCount) + Math.abs(negativeCount) + Math.abs(neutralCount);
      const sentimentScore = totalEmotions > 0 ? (positiveCount + negativeCount) / totalEmotions : 0;

      return {
        date: message.created_at,
        sentiment: sentimentScore,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const CustomYAxisTick = ({ x, y, payload }: any) => {
    let emoji;
    if (payload.value >= 0.8) emoji = "😊";
    else if (payload.value <= -0.8) emoji = "😔";
    else if (Math.abs(payload.value) < 0.3) emoji = "😕";
    else return null; // Hide other values

    return (
      <text x={x} y={y} dy={5} textAnchor="end" fill="#666">
        {emoji}
      </text>
    );
  };

  return (
    <div className="w-full h-[300px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{
            top: 10,
            right: 30,
            left: 30,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => format(parseISO(date), 'MMM d')}
          />
          <YAxis
            domain={[-1, 1]}
            ticks={[-0.8, 0, 0.8]}
            tick={<CustomYAxisTick />}
          />
          <Tooltip
            labelFormatter={(date) => format(parseISO(date as string), 'MMM d, yyyy')}
            formatter={(value: number) => {
              let emoji = "😕";
              if (value >= 0.8) emoji = "😊";
              else if (value <= -0.8) emoji = "😔";
              return [`${emoji} ${(value * 100).toFixed(0)}% ${value > 0 ? 'Positive' : value < 0 ? 'Negative' : 'Neutral'}`];
            }}
          />
          <Area
            type="monotone"
            dataKey="sentiment"
            stroke="#94a3b8"
            fill="#94a3b8"
            fillOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
} 