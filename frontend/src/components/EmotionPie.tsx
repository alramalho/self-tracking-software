"use client"

import { useMemo } from "react"
import { Label, Pie, PieChart } from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface EmotionPieProps {
  data: Array<{
    category: string;
    percentage: number;
  }>;
  numberOfMessages: number;
}

const chartConfig = {
  emotion: {
    label: "Emotion",
    color: "hsl(var(--chart-1))",
  },
  Optimism: {
    label: "Optimism",
    color: "hsl(var(--chart-optimism))",
  },
  Awe: {
    label: "Awe",
    color: "hsl(var(--chart-awe))",
  },
  Love: {
    label: "Love",
    color: "hsl(var(--chart-love))",
  },
  Submission: {
    label: "Submission",
    color: "hsl(var(--chart-submission))",
  },
  Remorse: {
    label: "Remorse",
    color: "hsl(var(--chart-remorse))",
  },
  Aggressiveness: {
    label: "Aggressiveness",
    color: "hsl(var(--chart-agressiveness))",
  },
  Disapproval: {
    label: "Disapproval",
    color: "hsl(var(--chart-disapproval))",
  },
  Contempt: {
    label: "Contempt",
    color: "hsl(var(--chart-8))",
  },
} satisfies ChartConfig

export function EmotionPie({ data, numberOfMessages }: EmotionPieProps) {
  // Transform data to include fill colors
  const pieData = useMemo(() => data.map(item => ({
    ...item,
    fill: chartConfig[item.category as keyof typeof chartConfig]?.color || "hsl(var(--chart-9))"
  })), [data]);

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[300px] [&_.recharts-sector:hover]:opacity-80 [&_.recharts-sector]:transition-opacity"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent nameKey="category" hideLabel unit="%" />}
        />
        <Pie
          data={pieData}
          dataKey="percentage"
          nameKey="category"
          innerRadius={65}
          strokeWidth={2}
          stroke="#fff"
        >
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-3xl font-bold"
                    >
                      {numberOfMessages.toLocaleString()}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy || 0) + 20}
                      className="fill-muted-foreground text-xs font-medium"
                    >
                      Messages
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
} 