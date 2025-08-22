"use client"

import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"

interface RadialProgressProps {
  value: number
  total: number
  title: string
  description?: string
  footer?: React.ReactNode
}

export function RadialProgress({
  value,
  total,
  title,
  description,
  footer
}: RadialProgressProps) {
  const percentage = (value / total) * 100
  const angle = (percentage / 100) * 360

  const chartData = [
    { 
      name: "Progress",
      value: angle,
      fill: "hsl(var(--chart-2))"
    }
  ]

  const chartConfig = {
    value: {
      label: "Progress",
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <RadialBarChart
            data={chartData}
            startAngle={90}
            endAngle={-(Math.round((value / total) * 360) - 90)}
            innerRadius={80}
            outerRadius={140}
          >
            <PolarGrid
              gridType="circle"
              className="first:fill-muted last:fill-background"
              polarRadius={[86, 74]}
              stroke="none"
            />
            <RadialBar
              dataKey="value"
              cornerRadius={15}
              background
            />
            <PolarRadiusAxis
              tick={false}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <g>
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-foreground font-bold text-3xl"
                        >
                          {value}
                        </text>
                        <text
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 25}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-muted-foreground text-sm"
                        >
                          of {total}
                        </text>
                      </g>
                    )
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      {footer && (
        <CardFooter className="flex-col gap-2 text-sm">
          {footer}
        </CardFooter>
      )}
    </Card>
  )
} 