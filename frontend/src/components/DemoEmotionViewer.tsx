"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmotionPie } from "./EmotionPie";
import { Button } from "./ui/button";
import { Lock } from "lucide-react";
import Link from "next/link";

export function DemoEmotionViewer() {
  // Mock data for the emotion distribution
  const mockChartData = [
    { category: "Optimism", percentage: 35 },
    { category: "Love", percentage: 25 },
    { category: "Awe", percentage: 20 },
    { category: "Remorse", percentage: 10 },
    { category: "Submission", percentage: 10 },
  ];

  return (
    <Card className="overflow-hidden bg-gradient-to-b from-white from-40% via-white/95 via-60% to-transparent to-90% relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent from-0% via-white/90 via-75% to-white to-100% z-10" />
      <CardHeader className="pb-4">
        <div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Emotional Profile Preview
          </CardTitle>
          <CardDescription className="text-xs font-medium">
            Get insights into your emotional patterns through voice messages
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <Card className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                Sample Emotion Distribution
              </CardTitle>
              <CardDescription>
                Example of how your emotions could be distributed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmotionPie data={mockChartData} numberOfMessages={42} />
            </CardContent>
          </Card>

          <div className="flex justify-center mt-4 z-20 relative">
            <Link href="/ai">
              <Button className="flex gap-2">
                <Lock className="h-4 w-4" />
                Get Access
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
