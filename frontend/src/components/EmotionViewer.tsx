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
import { EmotionAreaChartViewer } from "./EmotionAreaChartViewer";
import { DateRangeSlider } from "@/components/ui/date-range-slider";

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
  messages: Message[];
}

export function EmotionViewer({ messages }: EmotionViewerProps) {
  const dateRange = useMemo(() => {
    const dates = messages
      .filter((msg) => msg.created_at)
      .map((msg) => new Date(msg.created_at!).getTime());
    
    if (dates.length === 0) {
      const now = new Date().getTime();
      return {
        min: now,
        max: now,
      };
    }
    
    return {
      min: Math.min(...dates),
      max: Math.max(...dates),
    };
  }, [messages]);

  const [selectedRange, setSelectedRange] = useState<[number, number]>([
    dateRange.min,
    dateRange.max,
  ]);

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      if (!message.created_at) return false;
      const messageDate = new Date(message.created_at).getTime();
      return messageDate >= selectedRange[0] && messageDate <= selectedRange[1];
    });
  }, [messages, selectedRange]);

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

  const chartData = Object.entries(emotionCounts).map(([category, total]) => ({
    category,
    value:
      totalMessagesThatHaveEmotion > 0
        ? Math.round((total / totalMessagesThatHaveEmotion) * 100)
        : 0,
  }));

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-blue-50/80 to-white">
      <CardHeader className="pb-4">
        <div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Emotional Profile
          </CardTitle>
          <CardDescription className="text-xs font-medium">
            <Link
              href="https://github.com/alramalho/self-tracking-software"
              className="underline"
            >
              We don&apos;t store your voice data
            </Link>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex border rounded-lg p-2 h-[100px] items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">No messages yet</p>
                <p className="text-sm text-muted-foreground"><Link href="/ai" className="underline">Start a conversation</Link> to see your emotional profile</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              <Card className="flex-1 min-w-[300px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Emotion Distribution</CardTitle>
                  <CardDescription>
                    Distribution of emotions in your messages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <>
                      <EmotionPie
                        data={chartData.map((item) => ({
                          category: item.category,
                          percentage: item.value,
                        }))}
                        numberOfMessages={totalMessagesThatHaveEmotion}
                      />
                      <span className="mt-4 block text-xs text-muted-foreground/80">
                        The percentage in the emotions represent the intensity
                        captured by our AI.
                      </span>
                    </>
                  ) : (
                    <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="w-full">
                <DateRangeSlider
                  minDate={new Date(dateRange.min)}
                  maxDate={new Date(dateRange.max)}
                  value={selectedRange}
                  onValueChange={setSelectedRange}
                  className="w-full"
                />
              </div>

              <Card className="flex-1 min-w-[300px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Emotional Journey</CardTitle>
                  <CardDescription>
                    Your emotional patterns over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EmotionAreaChartViewer messages={filteredMessages} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
