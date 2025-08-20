import React from "react";
import { WeekMetricBarChart } from "@/components/WeekMetricBarChart";
import { Activity } from "@/contexts/UserGlobalContext";

interface Metric {
  id: string;
  emoji: string;
  title: string;
}

interface MetricCorrelation {
  activity: Activity;
  correlation: number;
}

interface MetricWeeklyViewProps {
  metric: Metric;
  weekData: number[];
  color:
    | "yellow"
    | "blue"
    | "green"
    | "rose"
    | "pink"
    | "red"
    | "orange"
    | "amber"
    | "purple"
    | "gray";
  hasAnyData: boolean;
  positiveCorrelations?: MetricCorrelation[];
  formatCorrelationString?: (correlation: MetricCorrelation) => string;
  className?: string;
}

export const MetricWeeklyView: React.FC<MetricWeeklyViewProps> = ({
  metric,
  weekData,
  color,
  hasAnyData,
  positiveCorrelations = [],
  formatCorrelationString,
  className = "",
}) => {
  return (
    <div
      className={`my-2 bg-white/60 ring-1 ring-gray-200 rounded-3xl p-4 border border-white/50 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-normal">
          {metric.emoji} {metric.title}{" "}
          <span className="font-semibold italic">Week Overview</span>
        </span>
        <span className="text-xs text-gray-500">Last 7 days</span>
      </div>
      {hasAnyData ? (
        <WeekMetricBarChart data={weekData} color={color} />
      ) : (
        <div className="py-2 text-center">
          <p className="text-sm text-gray-500">
            No data this week. Start logging above!
          </p>
        </div>
      )}
      {positiveCorrelations.length > 0 && formatCorrelationString && (
        <div className="text-xs text-gray-600 mt-3">
          {positiveCorrelations.slice(0, 2).map((correlation, i) => (
            <span key={correlation.activity.id}>
              <span className="text-green-600">
                {formatCorrelationString(correlation)}
              </span>
              {i < Math.min(positiveCorrelations.length - 1, 1)
                ? " and "
                : ` boost your ${metric.title.toLowerCase()}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}; 