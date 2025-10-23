import React, { useMemo, useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import { CorrelationEntry } from "@/components/metrics/CorrelationEntry";
import { ReliabilityHelpPopover } from "@/components/metrics/ReliabilityHelpPopover";
import { ACTIVITY_WINDOW_DAYS } from "@/lib/metrics";
import type { Activity, ActivityEntry, MetricEntry } from "@tsw/prisma";

export interface Correlation {
  activity: Activity;
  correlation: number;
  sampleSize: number;
}

interface MetricInsightsCardProps {
  metric: {
    id: string;
    title: string;
    emoji: string;
  };
  activities?: Activity[];
  activityEntries?: ActivityEntry[];
  metricEntries?: MetricEntry[];
  onHelpClick: () => void;
  hardcodedCorrelations?: Correlation[];
}

// Calculate Pearson correlation between two arrays
const calculatePearsonCorrelation = (x: number[], y: number[]): number => {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;

  const sum1 = x.reduce((a, b) => a + b, 0);
  const sum2 = y.reduce((a, b) => a + b, 0);
  const sum1Sq = x.reduce((a, b) => a + b * b, 0);
  const sum2Sq = y.reduce((a, b) => a + b * b, 0);
  const pSum = x.reduce((a, b, i) => a + b * y[i], 0);

  const num = pSum - (sum1 * sum2) / n;
  const den = Math.sqrt(
    (sum1Sq - (sum1 * sum1) / n) * (sum2Sq - (sum2 * sum2) / n)
  );

  return den === 0 ? 0 : num / den;
};

// Check if an activity happened within the configured window before a date
const activityHappenedWithinWindow = (
  activityId: string,
  targetDate: Date,
  activityEntries: ActivityEntry[]
): boolean => {
  const windowStart = new Date(targetDate);
  windowStart.setDate(windowStart.getDate() - ACTIVITY_WINDOW_DAYS);

  return activityEntries.some((entry) => {
    const entryDate = new Date(entry.date);
    return (
      entry.activityId === activityId &&
      entryDate >= windowStart &&
      entryDate <= targetDate
    );
  });
};

export function MetricInsightsCard({
  metric,
  activities = [],
  activityEntries = [],
  metricEntries = [],
  onHelpClick,
  hardcodedCorrelations,
}: MetricInsightsCardProps) {
  const [showReliabilityHelp, setShowReliabilityHelp] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Intersection Observer to detect when card enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 } // Trigger when 10% of the card is visible
    );

    const currentRef = cardRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  // Calculate correlations for the metric
  const calculatedCorrelations = useMemo(() => {
    const filteredMetricEntries = metricEntries
      .filter((entry) => entry.metricId === metric.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const calculatedCorrelations = activities
      .map((activity) => {
        const binaryActivityArray = filteredMetricEntries.map((entry) => {
          const didActivity = activityHappenedWithinWindow(
            activity.id,
            new Date(entry.date),
            activityEntries
          );
          return didActivity ? 1 : 0;
        });

        // Count how many times this activity actually occurred (sample size for this specific activity)
        const activitySampleSize = binaryActivityArray.filter((v) => v === 1).length;

        // Only calculate correlation if the activity has some occurrences
        if (activitySampleSize > 0) {
          const ratings = filteredMetricEntries.map((e) => e.rating);

          const correlation = calculatePearsonCorrelation(
            ratings,
            binaryActivityArray
          );

          return {
            activity,
            correlation,
            sampleSize: activitySampleSize,
          };
        }
        return null;
      })
      .filter((c): c is Correlation => c !== null);

    // Sort by absolute correlation value
    return calculatedCorrelations.sort(
      (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
    );
  }, [metric.id, activities, activityEntries, metricEntries]);

  // Use hardcoded correlations if provided, otherwise use calculated
  const correlations = hardcodedCorrelations || calculatedCorrelations;

  return (
    <Card ref={cardRef} className="p-6 rounded-2xl">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex flex-row items-center gap-2">
            <span className="text-4xl">{metric.emoji}</span>
            <h2 className="text-lg font-bold">{metric.title} Insights</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            onClick={onHelpClick}
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4">
          {correlations.map((correlation, index) => (
            <CorrelationEntry
              key={correlation.activity.id}
              title={`${correlation.activity.emoji || "📊"} ${correlation.activity.title}`}
              pearsonValue={correlation.correlation}
              sampleSize={correlation.sampleSize}
              onReliabilityClick={() => setShowReliabilityHelp(true)}
              isVisible={isVisible}
              animationDelay={index * 100} // Stagger animation by 100ms per bar
            />
          ))}
        </div>
      </div>

      <ReliabilityHelpPopover
        isOpen={showReliabilityHelp}
        onClose={() => setShowReliabilityHelp(false)}
      />
    </Card>
  );
}
