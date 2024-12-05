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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns"
import { useEffect, useMemo, useState } from "react"

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
  const [selectedMonth, setSelectedMonth] = useState<string>("")

  // Get available months from messages
  const availableMonths = useMemo(() => {
    const months = new Set<string>()
    messages.forEach(message => {
      if (message.created_at) {
        const monthKey = format(parseISO(message.created_at), "yyyy-MM")
        months.add(monthKey)
      }
    })
    return Array.from(months).sort().reverse() // Most recent first
  }, [messages])

  // Set initial month to most recent
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0])
    }
  }, [availableMonths, selectedMonth])

  // Filter messages by selected month
  const filteredMessages = useMemo(() => {
    if (!selectedMonth) return []
    
    const start = startOfMonth(parseISO(selectedMonth))
    const end = endOfMonth(parseISO(selectedMonth))
    
    return messages.filter(message => {
      if (!message.created_at) return false
      const date = parseISO(message.created_at)
      return date >= start && date <= end
    })
  }, [messages, selectedMonth])

  // Process messages to get emotion categories data
  const emotionCounts: { [key: string]: number } = {};
  let totalMessages = 0;

  filteredMessages.forEach(message => {
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
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map(month => (
              <SelectItem key={month} value={month}>
                {format(parseISO(month), "MMMM yyyy")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pb-0">
        {chartData.length > 0 ? (
          <EmotionRadar data={chartData} />
        ) : (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No data available for selected month
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          {totalMessages} messages analyzed
        </div>
        {chartData.length > 0 && (
          <div className="flex items-center gap-2 leading-none text-muted-foreground">
            Most prevalent: {chartData.sort((a, b) => b.value - a.value)[0]?.category}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}