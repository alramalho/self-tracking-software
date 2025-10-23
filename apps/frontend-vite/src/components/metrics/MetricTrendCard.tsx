import { MetricBarChart } from "@/components/MetricBarChart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type MetricEntry } from "@tsw/prisma";
import { isSameDay } from "date-fns";
import { HelpCircle, TrendingDown, TrendingUp } from "lucide-react";

interface MetricTrendCardProps {
  metric: {
    id: string;
    title: string;
    emoji: string;
  };
  trend: number;
  thisWeekAvg: number;
  lastWeekAvg: number;
  thisWeekEntries: MetricEntry[];
  lastWeekEntries: MetricEntry[];
  onHelpClick: () => void;
}

export function MetricTrendCard({
  metric,
  trend,
  thisWeekAvg,
  lastWeekAvg,
  thisWeekEntries,
  lastWeekEntries,
  onHelpClick,
}: MetricTrendCardProps) {
  const TrendIcon = trend >= 0 ? TrendingUp : TrendingDown;
  const trendColor = trend >= 0 ? "text-green-500" : "text-red-500";

  // Prepare data for last 7 days (this week)
  const thisWeekData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const entry = thisWeekEntries.find((e) => isSameDay(new Date(e.date), date));
    return entry ? entry.rating : 0;
  });

  // Prepare data for previous 7 days (last week)
  const lastWeekData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - i));
    const entry = lastWeekEntries.find((e) => isSameDay(new Date(e.date), date));
    return entry ? entry.rating : 0;
  });

  return (
    <Card className="p-6 rounded-2xl">
      <div className="space-y-4">
        <div className="flex flex-row justify-between items-center gap-2 w-full">
          <span className="text-4xl">{metric.emoji}</span>
          <div className="flex flex-col items-start justify-between w-full">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-left">
                <span className="text-lg">{metric.title} Trend</span>{" "}
              </h2>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-row justify-between items-center gap-2 w-full">
                <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
                  <TrendIcon className="h-4 w-4" />
                  {Math.abs(trend).toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">Last 14 days</p>
              </div>
            </div>
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
        <ul className="text-sm text-muted-foreground list-disc list-inside">
          <li>
            This week&apos;s avg:{" "}
            <span className="font-bold font-mono">
              {thisWeekEntries.length > 0 ? thisWeekAvg.toFixed(2) : "No data"}
            </span>
          </li>
          <li>
            Last week&apos;s avg:{" "}
            <span className="font-bold font-mono">
              {lastWeekEntries.length > 0 ? lastWeekAvg.toFixed(2) : "No data"}
            </span>
          </li>
        </ul>
        <div className="space-y-3 pt-2">
          <MetricBarChart
            data={thisWeekData}
            color="green"
            label="This week"
          />
          <MetricBarChart
            data={lastWeekData}
            color="green"
            label="Last week"
            dimmed
          />
        </div>
      </div>
    </Card>
  );
}
