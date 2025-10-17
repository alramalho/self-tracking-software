import React from "react";
import { WeekMetricBarChart } from "@/components/WeekMetricBarChart";
import { ExampleCorrelations } from "@/components/ExampleCorrelations";

interface InsightsDemoProps {
  showCorrelations?: boolean;
  className?: string;
}

const demoMetrics: Array<{
  emoji: string;
  name: string;
  trend: string;
  data: number[];
  bgColor:
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
  correlations: string[];
}> = [
  {
    emoji: "😊",
    name: "Happiness",
    trend: "+15%",
    data: [4, 3, 5, 4, 1, 3, 5],
    bgColor: "blue",
    correlations: ["🏃‍♂️ Exercise", "🧘‍♂️ Meditation"],
  },
  {
    emoji: "⚡",
    name: "Energy",
    trend: "+8%",
    data: [3, 4, 3, 5, 4, 3, 4],
    bgColor: "yellow",
    correlations: ["☕ Morning routine"],
  },
];

export const InsightsDemo: React.FC<InsightsDemoProps> = ({
  showCorrelations = true,
  className = "",
}) => {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Demo Metrics Preview */}
      <div className="space-y-4">
        <div className="text-sm font-medium text-foreground mb-3">
          Preview: Track metrics like happiness, energy & productivity
        </div>

        {demoMetrics.map((metric) => (
          <div
            key={metric.name}
            className="bg-card/60 rounded-lg p-4 border border-card/50"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {metric.emoji} {metric.name}
              </span>
              <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                {metric.trend} this week
              </span>
            </div>
            <WeekMetricBarChart
              data={metric.data}
              color={metric.bgColor}
            />
            <div className="text-xs text-muted-foreground mt-2">
              {metric.correlations.map((correlation, i) => (
                <span key={correlation}>
                  <span className="text-green-600">{correlation}</span>
                  {i < metric.correlations.length - 1
                    ? " and "
                    : " boost your " + metric.name.toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Example Correlations */}
      {showCorrelations && <ExampleCorrelations />}
    </div>
  );
};

export default InsightsDemo;