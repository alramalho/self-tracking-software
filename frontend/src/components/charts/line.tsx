"use client"

import { TrendingUp } from "lucide-react"
import { Line, LineChart as RechartsLineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { parse, startOfWeek, endOfWeek, isWithinInterval } from "date-fns"

interface DataPoint {
  [key: string]: string | number
}

interface LineChartProps {
  data: DataPoint[]
  xAxisKey: string
  lines: {
    dataKey: string
    name: string
    color: string
  }[]
  title?: string
  description?: string
  trendPercentage?: number
  dateRange?: string
  currentDate?: Date // Add this new prop
}

export function LineChart({
  data,
  xAxisKey,
  lines,
  title = "Line Chart",
  description = "Data visualization",
  trendPercentage,
  dateRange,
  currentDate, // Add this new prop
}: LineChartProps) {
  const chartConfig = lines.reduce((config, line) => {
    config[line.dataKey] = {
      label: line.name,
      color: line.color,
    }
    return config
  }, {} as ChartConfig)

  // Find the week that contains the current date
  const currentWeek = currentDate ? data.find(item => {
    // Parse the date string correctly
    const itemDate = parse(item.week.toString(), 'MMM d, yyyy', new Date());
    const weekStart = startOfWeek(itemDate);
    const weekEnd = endOfWeek(itemDate);
    return isWithinInterval(currentDate, { start: weekStart, end: weekEnd });
  }) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <ResponsiveContainer width="100%" height={400}>
            <RechartsLineChart
              data={data}
              margin={{
                top: 20, // Increased top margin to accommodate the label
                right: 30,
                left: 20,
                bottom: 20,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={xAxisKey}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              {lines.map((line) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
              
              {/* Updated ReferenceLine for the current week */}
              {currentWeek && (
                <ReferenceLine
                  x={currentWeek.week}
                  stroke="#888"
                  strokeDasharray="3 3"
                  label={{
                    value: "This week",
                    position: "top",
                    fill: "#888",
                    fontSize: 12,
                    offset: 10, // Adjust this value to fine-tune the label position
                  }}
                />
              )}
            </RechartsLineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
      {(trendPercentage || dateRange) && (
        <CardFooter>
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              {trendPercentage && (
                <div className="flex items-center gap-2 font-medium leading-none">
                  Trending {trendPercentage > 0 ? 'up' : 'down'} by {Math.abs(trendPercentage)}% this month
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
  )
}
