"use client";

import { MetricIsland } from "@/components/MetricIsland";
import { MetricWeeklyView } from "@/components/MetricWeeklyView";
import { TodaysNoteSection } from "@/components/TodaysNoteSection";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PulsatingCirclePill } from "@/components/ui/pulsating-circle-pill";
import { useActivities } from "@/contexts/activities/useActivities";
import { useDailyCheckin } from "@/contexts/daily-checkin";
import { useMetrics } from "@/contexts/metrics";
import {
  getMetricWeekData,
  getPositiveCorrelations,
} from "@/contexts/metrics/lib";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useNavigate } from "@tanstack/react-router";
import { type MetricEntry } from "@tsw/prisma";
import { isToday } from "date-fns";
import { ChevronDown, ChevronRight, CircleCheckBig } from "lucide-react";
import React from "react";

const getMetricColor = (index: number) => {
  const colors = [
    "blue",
    "yellow",
    "green",
    "purple",
    "rose",
    "orange",
    "amber",
    "pink",
    "red",
    "gray",
  ] as const;
  return colors[index % colors.length];
};

export const HomepageMetricsSection: React.FC = () => {
  const navigate = useNavigate();
  const { metrics, entries: metricEntries } = useMetrics();
  const { activities, activityEntries } = useActivities();
  const [isMetricsCollapsed, setIsMetricsCollapsed] = useLocalStorage<boolean>(
    "metrics-section-collapsed",
    true
  );

  const { areAllMetricsCompleted } = useDailyCheckin();

  // Calculate unlogged metrics count
  const unloggedMetricsCount = metrics?.slice(0, 3).filter((metric) => {
    const todaysEntry = metricEntries?.find(
      (entry: MetricEntry) =>
        entry.metricId === metric.id && isToday(entry.date)
    );
    const isLoggedToday = !!todaysEntry && todaysEntry.rating > 0;
    const isSkippedToday = !!todaysEntry && todaysEntry.skipped;
    return !isLoggedToday && !isSkippedToday;
  }).length;

  const isAfter2PM = new Date().getHours() >= 14;
  const canLogMetrics =
    unloggedMetricsCount && unloggedMetricsCount > 0 && isAfter2PM;

  if (!canLogMetrics) {
    return (
      <>
        <h3 className="text-md font-semibold text-gray-900">Your Metrics</h3>
        <div className="bg-white/60 ring-1 ring-gray-200 rounded-xl p-2 border border-white/50 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-gray-500">
              Come back after 2PM to log your metrics
            </span>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="">
      <Collapsible
        open={!isMetricsCollapsed}
        onOpenChange={(open) => setIsMetricsCollapsed(!open)}
      >
        <div className="flex items-center justify-between mb-0">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <button
                className="p-1 hover:bg-gray-100 rounded transition-colors duration-200 flex items-center justify-center"
                aria-label={
                  isMetricsCollapsed ? "Expand metrics" : "Collapse metrics"
                }
              >
                {isMetricsCollapsed ? (
                  <ChevronRight size={16} className="text-gray-600" />
                ) : (
                  <ChevronDown size={16} className="text-gray-600" />
                )}
              </button>
            </CollapsibleTrigger>

            {isMetricsCollapsed && canLogMetrics ? (
              <div className="flex items-center gap-2">
                <span className="text-md font-semibold text-gray-900">
                  {unloggedMetricsCount} metric
                  {unloggedMetricsCount > 1 ? "s" : ""} to log today
                </span>
                <PulsatingCirclePill variant="yellow" size="md" />
              </div>
            ) : (
              <h3 className="text-md font-semibold text-gray-900">
                Your Metrics
              </h3>
            )}
          </div>
          <button
            onClick={() => navigate({ to: "/insights/dashboard" })}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
          >
            View Insights
            <ChevronRight size={16} />
          </button>
        </div>

        <CollapsibleContent>
          <div className="space-y-4 pt-1">
            <div className="flex flex-col gap-3 flex-wrap px-1 pb-1">
              {metrics?.slice(0, 3).map((metric, index) => {
                const todaysEntry = metricEntries?.find(
                  (entry: MetricEntry) =>
                    entry.metricId === metric.id && isToday(entry.date)
                );
                const isLoggedToday = !!todaysEntry && todaysEntry.rating > 0;
                const isSkippedToday = !!todaysEntry && todaysEntry.skipped;
                const todaysRating = todaysEntry?.rating;

                const weekData = getMetricWeekData(
                  metric.id,
                  metricEntries || []
                );
                const hasAnyData = weekData.some((val) => val > 0);
                const positiveCorrelations = getPositiveCorrelations(
                  metric.id,
                  metricEntries || [],
                  activities || [],
                  activityEntries || []
                );

                return (
                  <div key={`${metric.id}-${index}-homepage`}>
                    {isLoggedToday || isSkippedToday ? (
                      <div className="my-2 bg-white/60 ring-1 ring-gray-200 rounded-3xl p-4 border border-white/50">
                        {/* Weekly chart */}
                        <MetricWeeklyView
                          metric={metric}
                          weekData={weekData}
                          color={getMetricColor(index)}
                          hasAnyData={hasAnyData}
                          positiveCorrelations={positiveCorrelations}
                          className="!bg-transparent !ring-0 !border-0 !p-0 !m-0"
                        />

                        {/* Muted logged indicator at bottom */}
                        {isLoggedToday && (
                          <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-gray-100">
                            <CircleCheckBig className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-400 font-medium">
                              Logged today
                            </span>
                          </div>
                        )}

                        {isSkippedToday && (
                          <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-gray-100">
                            <span className="text-xs text-gray-400 font-medium">
                              Skipped today
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <MetricIsland
                          key={metric.id}
                          metric={metric}
                          isLoggedToday={isLoggedToday}
                          todaysRating={todaysRating}
                          isSkippedToday={isSkippedToday}
                        />
                      </>
                    )}
                  </div>
                );
              })}
              {areAllMetricsCompleted && <TodaysNoteSection />}
            </div>

            {metrics?.length && metrics.length > 3 && (
              <div className="text-center">
                <button
                  onClick={() => navigate({ to: "/insights/dashboard" })}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  +{metrics.length - 3} more metrics
                </button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
