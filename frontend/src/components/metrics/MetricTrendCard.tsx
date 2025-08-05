import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, TrendingUp, TrendingDown } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { MetricEntry } from "@/contexts/UserGlobalContext";

interface MetricTrendCardProps {
  metric: {
    id: string;
    title: string;
    emoji: string;
  };
  trend: number;
  chartData: Array<{
    date: string;
    rating: number;
  }>;
  thisWeekAvg: number;
  lastWeekAvg: number;
  thisWeekEntries: MetricEntry[];
  lastWeekEntries: MetricEntry[];
  onHelpClick: () => void;
}

export function MetricTrendCard({
  metric,
  trend,
  chartData,
  thisWeekAvg,
  lastWeekAvg,
  thisWeekEntries,
  lastWeekEntries,
  onHelpClick,
}: MetricTrendCardProps) {
  const TrendIcon = trend >= 0 ? TrendingUp : TrendingDown;
  const trendColor = trend >= 0 ? "text-green-500" : "text-red-500";

  return (
    <Card className="p-6">
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
            className="text-gray-400 hover:text-gray-600"
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
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
                stroke="#888888"
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
                stroke="#888888"
              />
              <Tooltip
                contentStyle={{
                  background: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="rating"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{
                  fill: "#22c55e",
                  r: 4,
                }}
                activeDot={{
                  r: 6,
                  fill: "#22c55e",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
} 