import AINotification from "@/components/AINotification";
import { DailyCheckinViewer } from "@/components/DailyCheckinViewer";
import { CorrelationHelpPopover } from "@/components/metrics/CorrelationHelpPopover";
import { MetricInsightsCard, type Correlation } from "@/components/metrics/MetricInsightsCard";
import { MetricTrendCard } from "@/components/metrics/MetricTrendCard";
import { TrendHelpPopover } from "@/components/metrics/TrendHelpPopover";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useActivities } from "@/contexts/activities/useActivities";
import { useMetrics } from "@/contexts/metrics";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { useCurrentUser } from "@/contexts/users";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { useThemeColors } from "@/hooks/useThemeColors";
import { defaultMetrics, MINIMUM_ENTRIES } from "@/lib/metrics";
import { getThemeVariants } from "@/utils/theme";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type Metric, type MetricEntry } from "@tsw/prisma";
import { subDays } from "date-fns";
import { ArrowDown, Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/insights/dashboard")({
  component: InsightsDashboardPage,
});

function InsightsDashboardPage() {
  const {
    metrics: userMetrics,
    entries,
    createMetric,
    hasLoadedMetricsAndEntries,
    isLoadingEntries,
    isLoadingMetrics,
  } = useMetrics();
  const { activities, activityEntries } = useActivities();
  const { currentUser } = useCurrentUser();

  const navigate = useNavigate();
  const themeColors = useThemeColors();
  const variants = getThemeVariants(themeColors.raw);
  const [helpMetricId, setHelpMetricId] = useState<string | null>(null);
  const [trendHelpMetricId, setTrendHelpMetricId] = useState<string | null>(
    null
  );
  const [aiMessage, setAIMessage] = useState<string | null>(null);
  const { setShowUpgradePopover } = useUpgrade();
  const { isUserFree } = usePaidPlan();
  const isUserOnFreePlan = isUserFree;

  if (isUserOnFreePlan && (hasLoadedMetricsAndEntries && userMetrics?.length === 0)) {
    navigate({ to: "/insights/onboarding" });
  }

  const addDefaultMetrics = async () => {
    const hasProductivity = userMetrics?.find(
      (m) => m.title === "Productivity"
    );
    const hasEnergy = userMetrics?.find((m) => m.title === "Energy");
    const hasHappiness = userMetrics?.find((m) => m.title === "Happiness");

    if (!hasProductivity) {
      const productivityMetric = defaultMetrics.find(
        (m) => m.title === "Productivity"
      );
      if (productivityMetric) {
        await createMetric(productivityMetric);
      }
    }
    if (!hasEnergy) {
      const energyMetric = defaultMetrics.find((m) => m.title === "Energy");
      if (energyMetric) {
        await createMetric(energyMetric);
      }
    }
    if (!hasHappiness) {
      const happinessMetric = defaultMetrics.find(
        (m) => m.title === "Happiness"
      );
      if (happinessMetric) {
        await createMetric(happinessMetric);
      }
    }
  };

  if (hasLoadedMetricsAndEntries && userMetrics?.length === 0) {
    return (
      <div className="mx-auto p-2 max-w-md space-y-8">
        <div className="p-2">
          <AINotification
            messages={[
              `Hey ${
                currentUser?.username ?? "there"
              }! Welcome to your insights page.`,
              "Here you can track how your activities affect metrics like happiness, energy and productivity.",
              "You can easily log your day by sending me a voice message about how you felt!",
            ]}
            createdAt={new Date().toISOString()}
          />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <ArrowDown className="w-4 h-4 inline-block mr-2" />
          Preview of what your metrics would look like
        </p>

        <div className="pointer-events-none p-4 space-y-2 rounded-lg bg-white/70 border border-gray-200 rounded-lg">
          {/* Add Demo Daily Check-ins */}
          <div>
            <h3 className="text-lg font-semibold my-4">Check-ins</h3>
            <DailyCheckinViewer
              entries={[
                { date: subDays(new Date(), 1).toISOString() },
                { date: subDays(new Date(), 2).toISOString() },
                { date: subDays(new Date(), 5).toISOString() },
              ]}
            />
          </div>

          {/* Demo Metrics Preview */}
          <div className="space-y-4">
            <MetricTrendCard
              metric={{ id: "demo", title: "Happiness", emoji: "😊" }}
              trend={15}
              thisWeekAvg={4.0}
              lastWeekAvg={3.2}
              thisWeekEntries={
                [
                  {
                    id: "demo1",
                    metricId: "demo",
                    rating: 5,
                    createdAt: new Date(new Date().setDate(new Date().getDate() - 1)),
                  },
                  {
                    id: "demo2",
                    metricId: "demo",
                    rating: 4,
                    createdAt: new Date(new Date().setDate(new Date().getDate() - 2)),
                  },
                  {
                    id: "demo3",
                    metricId: "demo",
                    rating: 4,
                    createdAt: new Date(new Date().setDate(new Date().getDate() - 3)),
                  },
                  {
                    id: "demo4",
                    metricId: "demo",
                    rating: 3,
                    createdAt: new Date(new Date().setDate(new Date().getDate() - 5)),
                  },
                  {
                    id: "demo5",
                    metricId: "demo",
                    rating: 4,
                    createdAt: new Date(new Date().setDate(new Date().getDate() - 6)),
                  },
                ] as MetricEntry[]
              }
              lastWeekEntries={
                [
                  {
                    id: "demo6",
                    metricId: "demo",
                    rating: 3,
                    createdAt: new Date(new Date().setDate(new Date().getDate() - 8)),
                  },
                  {
                    id: "demo7",
                    metricId: "demo",
                    rating: 2,
                    createdAt: new Date(new Date().setDate(new Date().getDate() - 10)),
                  },
                  {
                    id: "demo8",
                    metricId: "demo",
                    rating: 4,
                    createdAt: new Date(new Date().setDate(new Date().getDate() - 11)),
                  },
                  {
                    id: "demo9",
                    metricId: "demo",
                    rating: 3,
                    createdAt: new Date(new Date().setDate(new Date().getDate() - 13)),
                  },
                ] as MetricEntry[]
              }
              onHelpClick={() => setTrendHelpMetricId("demo")}
            />

            <MetricInsightsCard
              metric={{ id: "demo", title: "Happiness", emoji: "😊" }}
              hardcodedCorrelations={[
                {
                  activity: {
                    id: "exercise",
                    title: "Exercise",
                    emoji: "🏃‍♂️",
                  } as any,
                  correlation: 0.75,
                  sampleSize: 35,
                },
                {
                  activity: {
                    id: "meditation",
                    title: "Meditation",
                    emoji: "🧘‍♂️",
                  } as any,
                  correlation: 0.65,
                  sampleSize: 20,
                },
                {
                  activity: {
                    id: "gym",
                    title: "Gym",
                    emoji: "🏋️‍♂️",
                  } as any,
                  correlation: -0.35,
                  sampleSize: 12,
                },
                {
                  activity: {
                    id: "reading",
                    title: "Reading",
                    emoji: "📚",
                  } as any,
                  correlation: -0.05,
                  sampleSize: 8,
                },
              ] as Correlation[]}
              onHelpClick={() => setHelpMetricId("demo")}
            />

            <TrendHelpPopover
              isOpen={trendHelpMetricId === "demo"}
              onClose={() => setTrendHelpMetricId(null)}
              metricTitle="Happiness"
            />

            <CorrelationHelpPopover
              isOpen={helpMetricId === "demo"}
              onClose={() => setHelpMetricId(null)}
              metricTitle="Happiness"
            />
          </div>
        </div>
        <div className="px-4 pb-10">
          <Button
            className={`w-full ${
              isUserOnFreePlan
                ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                : ""
            }`}
            onClick={() => {
              setAIMessage(
                "Great! Let's get started with a checkin. Just tell me how your day went!"
              );
              if (isUserOnFreePlan) {
                setShowUpgradePopover(true);
              } else {
                addDefaultMetrics();
              }
            }}
          >
            {isUserOnFreePlan ? "Try the coaching freely" : "Start"}
          </Button>
        </div>
      </div>
    );
  }

  // Find the metric with the most entries
  const metricEntryCounts = userMetrics?.map((metric) => ({
    metric,
    count: entries?.filter((entry) => entry.metricId === metric.id).length,
  }));

  const renderProgressUI = (targetEntries: number, specificMetric?: Metric) => {
    const metricsToShow = specificMetric
      ? [
          {
            metric: specificMetric,
            count: entries?.filter((e) => e.metricId === specificMetric.id)
              .length,
          },
        ]
      : metricEntryCounts;

    return (
      <Card className="p-8">
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold">
              {specificMetric?.emoji} {specificMetric?.title}
            </h2>
            <p className="text-muted-foreground">
              {targetEntries === MINIMUM_ENTRIES
                ? "We need more data to generate meaningful insights. Keep logging your metrics daily!"
                : "We've analyzed your data but haven't found meaningful correlations with your activities yet. This could mean your activities and metrics don't overlap enough, or we need more data to find reliable patterns. Keep logging!"}
            </p>
          </div>

          <div className="space-y-6">
            {metricsToShow?.map(({ metric, count }) => {
              const progressPercent = ((count || 0) / targetEntries) * 100;
              return (
                <div key={metric.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>
                      {metric.emoji} {metric.title}
                    </span>
                    <span className="text-muted-foreground">
                      {count} / {targetEntries} entries
                    </span>
                  </div>
                  <Progress
                    value={progressPercent}
                    className="h-2"
                    indicatorColor={variants.indicator.active}
                  />
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground text-center mt-2">
              Rate {targetEntries} entries to generate meaningful insights.
            </p>
          </div>
        </div>
      </Card>
    );
  };

  if (isLoadingMetrics || isLoadingEntries) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin mr-3" />
        <p className="text-left">Loading your metrics...</p>
      </div>
    );
  }


  // Calculate next milestone based on current entries
  const getNextMilestone = (entries: number) => {
    const milestones = [MINIMUM_ENTRIES, 10, 15, 30, 45, 60, 90, 120];
    return (
      milestones.find((m) => entries < m) || milestones[milestones.length - 1]
    );
  };

  const calculateMetricTrend = (metricEntries: MetricEntry[]) => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Get entries from the last 14 days and sort them
    const recentEntries = metricEntries
      .filter((entry) => new Date(entry.createdAt) >= twoWeeksAgo)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (recentEntries.length < 2) return 0;

    // Split entries into this week and last week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const thisWeekEntries = recentEntries.filter(
      (entry) => new Date(entry.createdAt) >= oneWeekAgo
    );
    const lastWeekEntries = recentEntries.filter(
      (entry) => new Date(entry.createdAt) < oneWeekAgo
    );

    // Calculate averages
    const thisWeekAvg =
      thisWeekEntries.length > 0
        ? thisWeekEntries.reduce((sum, entry) => sum + entry.rating, 0) /
          thisWeekEntries.length
        : 0;
    const lastWeekAvg =
      lastWeekEntries.length > 0
        ? lastWeekEntries.reduce((sum, entry) => sum + entry.rating, 0) /
          lastWeekEntries.length
        : 0;

    // Calculate trend percentage
    if (lastWeekAvg === 0) return 0;
    return ((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100;
  };


  // Render insights when we have enough data
  return (
    <div className="mx-auto p-6 max-w-2xl space-y-8">
      <div>
        <h3 className="text-lg font-semibold my-4">Check-ins</h3>
        <DailyCheckinViewer
          entries={entries?.map((entry) => ({
            date: new Date(entry.createdAt).toISOString(),
          })) || []}
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold my-4">Metrics</h3>

        <div className="space-y-4">
          {userMetrics?.map((metric) => {
            const count = entries?.filter(
              (e) => e.metricId === metric.id
            ).length;

            // Check if we have enough data to show insights
            const hasEnoughData = count && count >= MINIMUM_ENTRIES;
            const trend = calculateMetricTrend(
              entries?.filter((e) => e.metricId === metric.id) || []
            );

            // Calculate weekly averages for display
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            const recentEntries = entries
              ?.filter((e) => e.metricId === metric.id)
              .filter((entry) => new Date(entry.createdAt) >= twoWeeksAgo)
              .sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );

            const thisWeekEntries = recentEntries?.filter(
              (entry) => new Date(entry.createdAt) >= oneWeekAgo
            );
            const lastWeekEntries = recentEntries?.filter(
              (entry) => new Date(entry.createdAt) < oneWeekAgo
            );

            const thisWeekAvg =
              (thisWeekEntries?.length || 0) > 0 && thisWeekEntries
                ? thisWeekEntries.reduce(
                    (sum, entry) => sum + entry.rating,
                    0
                  ) / thisWeekEntries.length
                : 0;
            const lastWeekAvg =
              (lastWeekEntries?.length || 0) > 0 && lastWeekEntries
                ? lastWeekEntries.reduce(
                    (sum, entry) => sum + entry.rating,
                    0
                  ) / lastWeekEntries.length
                : 0;

            if (!hasEnoughData) {
              const nextMilestone = getNextMilestone(count || 0);
              return renderProgressUI(nextMilestone, metric);
            }

            return (
              <div key={metric.id} className="space-y-4">
                <MetricTrendCard
                  metric={metric}
                  trend={trend}
                  thisWeekAvg={thisWeekAvg}
                  lastWeekAvg={lastWeekAvg}
                  thisWeekEntries={thisWeekEntries || []}
                  lastWeekEntries={lastWeekEntries || []}
                  onHelpClick={() => setTrendHelpMetricId(metric.id)}
                />

                <MetricInsightsCard
                  metric={metric}
                  activities={activities}
                  activityEntries={activityEntries}
                  metricEntries={entries || []}
                  onHelpClick={() => setHelpMetricId(metric.id)}
                />

                <TrendHelpPopover
                  isOpen={trendHelpMetricId === metric.id}
                  onClose={() => setTrendHelpMetricId(null)}
                  metricTitle={metric.title}
                />

                <CorrelationHelpPopover
                  isOpen={helpMetricId === metric.id}
                  onClose={() => setHelpMetricId(null)}
                  metricTitle={metric.title}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
