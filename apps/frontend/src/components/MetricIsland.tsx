import { MetricRatingSelector } from "@/components/MetricRatingSelector";
import { Button } from "@/components/ui/button";
import { useDailyCheckin } from "@/contexts/DailyCheckinContext";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getThemeVariants } from "@/utils/theme";
import { CircleCheckBig, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { PulsatingCirclePill } from "./ui/pulsating-circle-pill";

interface MetricIslandProps {
  metric: {
    id: string;
    title: string;
    emoji: string;
  };
  isLoggedToday: boolean;
  todaysRating?: number;
  isSkippedToday?: boolean;
  className?: string;
}

export const MetricIsland: React.FC<MetricIslandProps> = ({
  metric,
  isLoggedToday,
  todaysRating,
  isSkippedToday = false,
  className,
}) => {
  const { logIndividualMetric, skipMetric } = useDailyCheckin();
  const [isLogging, setIsLogging] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const currentHour = new Date().getHours();
  const isAfter2PM = currentHour >= 14;
  const canLogMetrics = isAfter2PM && !isLoggedToday && !isSkippedToday;

  const handleRatingSelect = async (rating: number) => {
    setIsLogging(true);
    try {
      await logIndividualMetric(metric.id, rating);
    } catch (error) {
      console.error("Failed to log metric:", error);
    } finally {
      setIsLogging(false);
    }
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      await skipMetric(metric.id);
    } catch (error) {
      console.error("Failed to skip metric:", error);
    } finally {
      setIsSkipping(false);
    }
  };

  if (isSkippedToday) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-3xl p-3 flex-1 min-w-0 opacity-50">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">{metric.emoji}</span>
          <span className="text-sm font-medium text-gray-600">
            {metric.title}
          </span>
          <span className="text-xs text-gray-500">Skipped Today</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`ring-1 rounded-3xl p-3 flex-1 min-w-0 shadow-sm bg-gray-50 backdrop-blur-sm ring-gray-200 ${
        isLoggedToday && "opacity-70"
      } ${className}`}
    >
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{metric.emoji}</span>
            <span className="text-sm font-medium text-gray-600">
              {metric.title}
            </span>
            {canLogMetrics && (
              <div className="flex items-center gap-2 opacity-50">
                <PulsatingCirclePill variant="yellow" size="sm" />
                <span className={`text-xs font-semibold ${variants.text}`}>
                  Missing Check-in
                </span>
              </div>
            )}
          </div>
          {isLoggedToday && (
            <span
              className={`flex items-center gap-1 ${variants.text} opacity-70`}
            >
              <CircleCheckBig className="w-6 h-6" />
            </span>
          )}
        </div>

        {canLogMetrics ? (
          <div className="flex flex-row items-center justify-between gap-3 mt-3">
            <MetricRatingSelector
              onRatingSelect={handleRatingSelect}
              loading={isLogging}
              disabled={isLogging || isSkipping}
              initialRating={todaysRating}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={isLogging || isSkipping}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 h-auto m-0 shrink-0"
            >
              {isSkipping ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Skip"
              )}
            </Button>
          </div>
        ) : (
          <>
            <span className="text-xs text-gray-500">
              Come back after 2 PM to log your daily metric
            </span>
          </>
        )}
      </div>
    </div>
  );
};
