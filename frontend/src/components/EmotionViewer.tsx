"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  BadgeCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Message } from "@/contexts/UserPlanContext";
import { EmotionPie } from "./EmotionPie";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Emotion {
  name: string;
  score: number;
  color: string;
}

interface MessageWithEmotions extends Message {
  emotions?: Emotion[];
}

const EMOTION_TO_CATEGORY = {
  Joy: "Optimism",
  Excitement: "Optimism",
  Interest: "Awe",
  "Surprise (positive)": "Awe",
  Contentment: "Optimism",
  Satisfaction: "Optimism",
  Relief: "Optimism",
  Admiration: "Awe",
  Amusement: "Love",
  Ecstasy: "Love",
  Love: "Love",
  Pride: "Optimism",
  Triumph: "Optimism",
  Realization: "Awe",
  "Aesthetic Appreciation": "Awe",
  Adoration: "Love",
  Calmness: "Optimism",
  Concentration: "Submission",
  Contemplation: "Awe",
  Determination: "Optimism",
  Desire: "Love",
  Romance: "Love",
  Nostalgia: "Remorse",
  Entrancement: "Awe",
  Awe: "Awe",
  Anger: "Aggressiveness",
  Anxiety: "Submission",
  Fear: "Submission",
  Sadness: "Remorse",
  Disgust: "Disapproval",
  Confusion: "Submission",
  Contempt: "Contempt",
  Disappointment: "Remorse",
  Distress: "Remorse",
  Embarrassment: "Submission",
  "Empathic Pain": "Remorse",
  Pain: "Remorse",
  Shame: "Remorse",
  "Surprise (negative)": "Awe",
  Tiredness: "Remorse",
  Awkwardness: "Disapproval",
  Boredom: "Disapproval",
  Doubt: "Submission",
  Craving: "Love",
} as const;

interface EmotionViewerProps {
  messages: MessageWithEmotions[];
}

export function EmotionViewer({ messages }: EmotionViewerProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Get available months from messages
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    messages.forEach((message) => {
      if (message.created_at) {
        const monthKey = format(parseISO(message.created_at), "yyyy-MM");
        months.add(monthKey);
      }
    });
    return Array.from(months).sort().reverse(); // Most recent first
  }, [messages]);

  // Set initial month to most recent
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  // Filter messages by selected month
  const filteredMessages = useMemo(() => {
    if (!selectedMonth) return [];

    const start = startOfMonth(parseISO(selectedMonth));
    const end = endOfMonth(parseISO(selectedMonth));

    return messages.filter((message) => {
      if (!message.created_at) return false;
      const date = parseISO(message.created_at);
      return date >= start && date <= end;
    });
  }, [messages, selectedMonth]);

  // Process messages to get emotion categories data
  const emotionCounts: { [key: string]: number } = {};
  let totalMessagesThatHaveEmotion = 0;

  filteredMessages.forEach((message) => {
    if (message.emotions && message.emotions.length > 0) {
      message.emotions.forEach((emotion) => {
        const category =
          EMOTION_TO_CATEGORY[
            emotion.name as keyof typeof EMOTION_TO_CATEGORY
          ] || "Other";
        emotionCounts[category] =
          (emotionCounts[category] || 0) + emotion.score;
      });
      totalMessagesThatHaveEmotion++;
    }
  });

  // Convert to chart data format and calculate averages
  const chartData = Object.entries(emotionCounts).map(([category, total]) => ({
    category,
    value:
      totalMessagesThatHaveEmotion > 0
        ? Math.round((total / totalMessagesThatHaveEmotion) * 100)
        : 0,
  }));

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-blue-50/80 to-white">
      <CardHeader className="space-y-4 pb-4">
        <div className="space-y-1.5">
          <CardTitle className="text-xl font-bold tracking-tight">
            <div className="flex items-center justify-between gap-2 flex-nowrap">
              <span>Emotional Profile</span>
              {/* <div className="flex items-center gap-2 rounded-full bg-blue-100/80 px-3 py-1">
                <BadgeCheck size={16} className="text-blue-500" />
                <span className="text-xs font-medium text-blue-700">
                  Premium
                </span>
              </div> */}
            </div>
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground/80">
            Chat with our Coach to generate insights based on your interactions.{" "}
            <br />
            <Link
              href="https://github.com/alramalho/self-tracking-software"
              className="underline"
            >
              <span className="text-xs font-medium">
                We don&apos;t store your voice data
              </span>
            </Link>
          </CardDescription>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px] bg-white/50 backdrop-blur-sm">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map((month) => (
              <SelectItem key={month} value={month}>
                {format(parseISO(month), "MMMM yyyy")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pb-0">
        <div className="rounded-lg bg-white/50 p-4 backdrop-blur-sm">
          {chartData.length > 0 ? (
            <>
            <EmotionPie
              data={chartData.map((item) => ({
                category: item.category,
                percentage: item.value,
              }))}
              numberOfMessages={totalMessagesThatHaveEmotion}
            />
            <span className="text-xs text-muted-foreground/80">
              The percentage in the emotions represent the intensity that our AI captured.
            </span>
            </>
          ) : (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No data available for selected month
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
