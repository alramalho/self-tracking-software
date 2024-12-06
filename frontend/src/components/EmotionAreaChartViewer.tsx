"use client";

import { Message } from "@/contexts/UserPlanContext";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      let emoji = "";
      let sentiment = "Neutral";
      
      if (value >= 0.8) {
        emoji = "😊";
        sentiment = "Very Positive";
      } else if (value >= 0.3) {
        emoji = "🙂";
        sentiment = "Positive";
      } else if (value <= -0.8) {
        emoji = "😔";
        sentiment = "Very Negative";
      } else if (value <= -0.3) {
        emoji = "🙁";
        sentiment = "Negative";
      }

      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                Date
              </span>
              <span className="font-bold text-muted-foreground">
                {format(parseISO(label), 'MMM d, yyyy')}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                Sentiment
              </span>
              <span className="font-bold">
                {emoji} {sentiment}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{
            top: 10,
            right: 30,
            left: 10,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => format(parseISO(date), 'MMM d')}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="text-xs text-muted-foreground"
          />
          <YAxis
            domain={[-1, 1]}
            ticks={[-0.8, -0.4, 0, 0.4, 0.8]}
            tick={<CustomYAxisTick />}
            axisLine={false}
            tickLine={false}
            width={20}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="sentiment"
            stroke="hsl(var(--primary))"
            fill="url(#sentimentGradient)"
            fillOpacity={1}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
} 