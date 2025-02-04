"use client";

import { Card } from "@/components/ui/card";
import { useUserPlan } from "@/contexts/UserPlanContext";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function InsightsPage() {
  const router = useRouter();
  const { useMetricsAndEntriesQuery } = useUserPlan();
  const metricsAndEntriesQuery = useMetricsAndEntriesQuery();
  const { data: metricsAndEntriesData } = metricsAndEntriesQuery;
  const metrics = metricsAndEntriesData?.metrics || [];
  const hasMetrics = metrics.length > 0;

  return (
    <div className="container mx-auto py-10 max-w-3xl space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Insights & AI</h1>
        <p className="text-md text-muted-foreground">
          Discover patterns in your activities and get AI-powered assistance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Insights Card */}
        <Card
          className="p-6 transition-all cursor-pointer hover:scale-105"
          onClick={() => {
            if (hasMetrics) {
              router.push("/insights/dashboard");
            } else {
              router.push("/insights/onboarding");
            }
          }}
        >
          <div className="flex items-center gap-4">
            <span className="text-4xl">📊</span>
            <div>
              <h3 className="font-semibold text-lg mb-2">Activity Insights</h3>
              <p className="text-sm text-muted-foreground">
                Discover patterns and correlations between your activities and
                well-being metrics
              </p>
            </div>
          </div>
        </Card>

        {/* AI Card */}
        <Card
          className="p-6 transition-all cursor-pointer hover:scale-105"
          onClick={() => router.push("/ai")}
        >
          <div className="flex items-center gap-4">
            <span className="text-4xl">🤖</span>
            <div>
              <h3 className="font-semibold text-lg mb-2">AI Assistant</h3>
              <p className="text-sm text-muted-foreground">
                Analyze emotions and extract activities from your entries with
                AI-powered tools
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
