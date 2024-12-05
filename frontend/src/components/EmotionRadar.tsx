"use client"

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface EmotionRadarProps {
  data: Array<{
    category: string;
    value: number;
  }>;
}

const chartConfig = {
  emotion: {
    label: "Emotion",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export function EmotionRadar({ data }: EmotionRadarProps) {
  // Calculate trend
  const trend = data.length >= 2 
    ? ((data[0].value - data[data.length-1].value) / data[data.length-1].value * 100).toFixed(1)
    : 0;

  const trendText = Number(trend) > 0 
    ? `Up ${trend}%` 
    : Number(trend) < 0 
    ? `Down ${Math.abs(Number(trend))}%`
    : "Stable";

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[300px]"
    >
      <RadarChart data={data}>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <PolarGrid gridType="circle" />
        <PolarAngleAxis 
          dataKey="category"
          tick={{ 
            fill: "hsl(var(--foreground))",
            fontSize: 12
          }}
        />
        <Radar
          dataKey="value"
          fill="hsl(var(--chart-1))"
          fillOpacity={0.6}
          dot={{
            r: 4,
            fillOpacity: 1,
          }}
          animationBegin={0}
          animationDuration={500}
        />
      </RadarChart>
    </ChartContainer>
  )
}