"use client";

import { TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Rectangle,
  Legend,
  ReferenceLine,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { parse, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

interface DataPoint {
  [key: string]: string | number;
}

interface BarChartProps {
  data: DataPoint[];
  xAxisKey: string;
  lines: {
    dataKey: string;
    name: string;
    color: string;
  }[];
  title?: string;
  description?: string;
  trendPercentage?: number;
  dateRange?: string;
  currentDate?: Date;
}

export function BarChart({
  data,
  xAxisKey,
  lines,
  title = "Bar Chart",
  description = "Data visualization",
  trendPercentage,
  dateRange,
  currentDate,
}: BarChartProps) {
  const chartConfig = lines.reduce((config, line) => {
    config[line.dataKey] = {
      label: line.name,
      color: line.color,
    };
    return config;
  }, {} as ChartConfig);

  const currentWeekIndex = currentDate
    ? data.findIndex((item) => {
        const itemDate = parse(item.week.toString(), "MMM d, yyyy", new Date());
        const weekStart = startOfWeek(itemDate);
        const weekEnd = endOfWeek(itemDate);
        return isWithinInterval(currentDate, {
          start: weekStart,
          end: weekEnd,
        });
      })
    : -1;

  // Function to determine if a week is in the future
  const isFutureWeek = (weekStr: string) => {
    if (!currentDate) return false;
    const weekDate = parse(weekStr, "MMM d, yyyy", new Date());
    return weekDate > currentDate;
  };

  const dataLength = data.length;
  const linesLength = lines.length;
  const minWidth = 100 + dataLength * linesLength * 20;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[440px] overflow-x-auto p-0">
        <ChartContainer config={chartConfig}>
          <div className="h-[350px]" style={{ minWidth: `${minWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart
                data={data}
                // margin={{
                //   top: 20,
                //   right: 10,
                //   left: -10,
                //   bottom: 10,
                // }}
                // barGap={0}
                // barCategoryGap={20}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey={xAxisKey}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                {currentWeekIndex !== -1 && (
                  <ReferenceLine
                    x={data[currentWeekIndex].week}
                    stroke="#888"
                    strokeDasharray="3 3"
                    label={{
                      value: "This week",
                      position: "top",
                      fill: "#888",
                      fontSize: 12,
                      offset: 10,
                    }}
                  />
                )}
                {lines.map((line) => (
                  <Bar
                    key={line.dataKey}
                    dataKey={line.dataKey}
                    name={line.name}
                    fill={line.color}
                    radius={[4, 4, 4, 4]}
                    activeIndex={currentWeekIndex}
                    // shape={(props: any) => {
                    //   const opacity = isFutureWeek(props.week.toString())
                    //     ? 0.4
                    //     : 1;
                    //   return (
                    //     <Rectangle
                    //       {...props}
                    //       x={props.x - 10}
                    //       width={20}
                    //       fillOpacity={opacity}
                    //     />
                    //   );
                    // }}
                    // activeBar={({ ...props }) => (
                    //   <Rectangle
                    //     {...props}
                    //     x={props.x - 10}
                    //     fillOpacity={0.8}
                    //     width={20}
                    //     stroke={line.color}
                    //     strokeDasharray={4}
                    //     strokeDashoffset={4}
                    //   />
                    // )}
                  />
                ))}
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconSize={10}
                  wrapperStyle={{
                    paddingTop: "20px",
                    bottom: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                  }}
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </ChartContainer>
      </CardContent>
      {(trendPercentage || dateRange) && (
        <CardFooter>
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              {trendPercentage && (
                <div className="flex items-center gap-2 font-medium leading-none">
                  Trending {trendPercentage > 0 ? "up" : "down"} by{" "}
                  {Math.abs(trendPercentage)}% this month
                  <TrendingUp className="h-4 w-4" />
                </div>
              )}
              {dateRange && (
                <div className="flex items-center gap-2 leading-none text-muted-foreground">
                  {dateRange}
                </div>
              )}
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
