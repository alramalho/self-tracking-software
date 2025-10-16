import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlanGroupProgress } from "@/hooks/usePlanGroupProgress";
import { Loader2, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PlanGroupProgressChartProps {
  planId: string;
}

const STATUS_COLORS = {
  COMPLETED: "hsl(221, 60%, 55%)", // milder blue
  ON_TRACK: "hsl(142, 45%, 45%)", // milder green
  AT_RISK: "hsl(38, 70%, 55%)", // milder yellow/orange
  FAILED: "hsl(0, 65%, 55%)", // milder red
  NULL: "hsl(var(--muted-foreground))", // neutral gray for no status
  DEFAULT: "hsl(var(--muted-foreground))", // use theme muted color
};

const STATUS_LABELS = {
  COMPLETED: "Completed",
  ON_TRACK: "On Track",
  AT_RISK: "At Risk",
  FAILED: "Off Track",
  NULL: "Not Tracked",
};

export function PlanGroupProgressChart({ planId }: PlanGroupProgressChartProps) {
  const { data, isLoading, error } = usePlanGroupProgress(planId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null; // Silently don't render if plan has no group
  }

  if (data.members.length <= 1) {
    return null; // Don't show for single-member groups
  }

  // Prepare chart data
  const chartData = data.members.map((member) => ({
    name: member.name,
    username: member.username,
    picture: member.picture,
    completed: member.weeklyActivityCount,
    target: member.target,
    isCoached: member.isCoached,
    status: member.status,
    userId: member.userId,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={data.picture || undefined} />
              <AvatarFallback>{data.name[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <p className="font-semibold text-sm">{data.name}</p>
          </div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Completed:</span>
              <span className="font-medium">{data.completed}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Target:</span>
              <span className="font-medium">{data.target}</span>
            </div>
            {data.isCoached && (
              <div className="pt-1 mt-1 border-t">
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    data.status === "ON_TRACK"
                      ? "bg-green-500/10 text-green-600 dark:text-green-500"
                      : data.status === "AT_RISK"
                        ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500"
                        : data.status === "FAILED"
                          ? "bg-red-500/10 text-red-600 dark:text-red-500"
                          : data.status === "COMPLETED"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-500"
                            : "bg-gray-500/10 text-gray-600 dark:text-gray-500"
                  }`}
                >
                  {data.status && data.status in STATUS_LABELS
                    ? STATUS_LABELS[data.status as keyof typeof STATUS_LABELS]
                    : STATUS_LABELS.NULL}
                </Badge>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomXAxisTick = ({ x, y, payload }: any) => {
    const member = chartData[payload.index];
    if (!member) return null;

    return (
      <g transform={`translate(${x},${y})`}>
        <foreignObject x={-20} y={0} width={40} height={40}>
          <div className="flex items-center justify-center">
            <Avatar className="h-8 w-8">
              <AvatarImage src={member.picture || undefined} />
              <AvatarFallback className="text-xs">
                {member.name[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </foreignObject>
        <text
          x={0}
          y={48}
          textAnchor="middle"
          fill="hsl(var(--muted-foreground))"
          className="text-xs"
        >
          {member.name.split(" ")[0]}
        </text>
      </g>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Group Progress This Week
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              tick={<CustomXAxisTick />}
              height={80}
              interval={0}
            />
            <YAxis
              label={{
                value: "Activities",
                angle: -90,
                position: "insideLeft",
                style: {
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 12,
                },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="completed" name="Completed" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => {
                let fillColor = STATUS_COLORS.DEFAULT;
                if (entry.isCoached) {
                  // For coached plans, use status-based colors
                  if (entry.status && entry.status in STATUS_COLORS) {
                    fillColor = STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS];
                  } else if (entry.status === null) {
                    fillColor = STATUS_COLORS.NULL;
                  }
                }
                return <Cell key={`cell-${index}`} fill={fillColor} />;
              })}
            </Bar>
            <Bar
              dataKey="target"
              name="Target"
              fill="hsl(var(--muted))"
              opacity={0.3}
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Legend for status */}
        {chartData.some((m) => m.isCoached) && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              Progress Status (coached plans only):
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <Badge
                  key={key}
                  variant="outline"
                  className={`text-xs ${
                    key === "ON_TRACK"
                      ? "bg-green-500/10 text-green-600 dark:text-green-500"
                      : key === "AT_RISK"
                        ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500"
                        : key === "FAILED"
                          ? "bg-red-500/10 text-red-600 dark:text-red-500"
                          : key === "COMPLETED"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-500"
                            : "bg-gray-500/10 text-gray-600 dark:text-gray-500"
                  }`}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
