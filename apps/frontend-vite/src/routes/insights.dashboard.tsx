import AINotification from "@/components/AINotification";
import AppleLikePopover from "@/components/AppleLikePopover";
import { DailyCheckinViewer } from "@/components/DailyCheckinViewer";
import { DayOfWeekInsights } from "@/components/metrics/DayOfWeekInsights";
import { MetricCard } from "@/components/metrics/MetricCard";
import { MetricHeatmap } from "@/components/metrics/MetricHeatmap";
import { MetricInsightsCard } from "@/components/metrics/MetricInsightsCard";
import { MetricTrendCard } from "@/components/metrics/MetricTrendCard";
import { Button } from "@/components/ui/button";
import { TextAreaWithVoice } from "@/components/ui/text-area-with-voice";
import { useActivities } from "@/contexts/activities/useActivities";
import { useContextEvents } from "@/contexts/context-events";
import { useMetrics } from "@/contexts/metrics";
import { getMetricEventImpacts } from "@/contexts/metrics/lib";
import { useUpgrade } from "@/contexts/upgrade/useUpgrade";
import { useCurrentUser } from "@/contexts/users";
import { useFeedback } from "@/hooks/useFeedback";
import { usePaidPlan } from "@/hooks/usePaidPlan";
import { validRatings, type ActivityFinding } from "@/lib/metricFindings";
import { defaultMetrics, MINIMUM_ENTRIES } from "@/lib/metrics";
import { toMidnightUTCDate } from "@/lib/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type MetricEntry } from "@tsw/prisma";
import { subDays } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Divider from "@/components/Divider";

export const Route = createFileRoute("/insights/dashboard")({
  component: InsightsDashboardPage,
});

// Made-up numbers for the preview shown before someone tracks any metric.
const exampleMetric = { id: "demo", title: "Happiness", emoji: "😊" };
// [days ago, rating]. A check-in is saved as its calendar date at UTC midnight.
const exampleCheckIns = [
  [1, 5],
  [2, 4],
  [3, 4],
  [5, 3],
  [6, 4],
  [8, 3],
  [10, 2],
  [11, 4],
  [13, 3],
].map(
  ([daysAgo, rating]) =>
    ({
      id: `example-${daysAgo}`,
      metricId: exampleMetric.id,
      rating,
      skipped: false,
      createdAt: toMidnightUTCDate(subDays(new Date(), daysAgo)),
    }) as MetricEntry
);
const exampleFindings: ActivityFinding[] = [
  {
    activity: { id: "gym", title: "Gym", emoji: "🏋️‍♂️" },
    average: 3.0,
    otherAverage: 3.8,
    difference: -0.21,
    days: 16,
    otherDays: 40,
  },
  {
    activity: { id: "exercise", title: "Exercise", emoji: "🏃‍♂️" },
    average: 4.0,
    otherAverage: 3.4,
    difference: 0.18,
    days: 35,
    otherDays: 31,
  },
  {
    activity: { id: "reading", title: "Reading", emoji: "📚" },
    average: 3.6,
    otherAverage: 3.5,
    difference: 0.03,
    days: 8,
    otherDays: 50,
  },
  {
    activity: { id: "piano", title: "Piano", emoji: "🎹" },
    average: 4.0,
    otherAverage: 3.5,
    difference: null,
    days: 2,
    otherDays: 56,
  },
];

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
  const { data: contextEvents = [] } = useContextEvents();
  const { currentUser } = useCurrentUser();

  const navigate = useNavigate();
  const [aiMessage, setAIMessage] = useState<string | null>(null);
  const { setShowUpgradePopover } = useUpgrade();
  const { isUserFree } = usePaidPlan();
  const isUserOnFreePlan = isUserFree;
  const { sendFeedback, isSendingFeedback } = useFeedback();

  // Selected metric state for toggle pattern
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  // Metric request popover state
  const [showMetricRequestPopover, setShowMetricRequestPopover] = useState(false);
  const [metricRequestText, setMetricRequestText] = useState("");

  // Auto-select first metric when metrics load
  useEffect(() => {
    if (userMetrics && userMetrics.length > 0 && !selectedMetricId) {
      setSelectedMetricId(userMetrics[0].id);
    }
  }, [userMetrics, selectedMetricId]);

  const selectedMetric = userMetrics?.find((m) => m.id === selectedMetricId);
  const selectedMetricEntries = entries?.filter(
    (e) => e.metricId === selectedMetricId
  ) || [];
  // Skipped check-ins carry no rating, so they are left out of every card.
  const selectedCheckIns = validRatings(selectedMetricEntries);
  const selectedMetricEventImpacts = useMemo(() => {
    if (!selectedMetricId) return [];

    return getMetricEventImpacts(
      selectedMetricId,
      entries || [],
      contextEvents,
    );
  }, [contextEvents, entries, selectedMetricId]);

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
            <MetricInsightsCard
              metric={exampleMetric}
              exampleFindings={exampleFindings}
            />

            <MetricTrendCard metric={exampleMetric} entries={exampleCheckIns} />
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

  if (isLoadingMetrics || isLoadingEntries) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin mr-3" />
        <p className="text-left">Loading your metrics...</p>
      </div>
    );
  }


  // Handle metric selection toggle
  const handleMetricSelect = (metricId: string) => {
    if (selectedMetricId === metricId) {
      setSelectedMetricId(null);
    } else {
      setSelectedMetricId(metricId);
    }
  };

  // Render insights when we have enough data
  return (
    <div className="mx-auto p-6 max-w-2xl space-y-8">
      {/* Check-ins Section */}
      <div>
        <h3 className="text-lg font-semibold my-4">Check-ins</h3>
        <DailyCheckinViewer
          entries={entries?.map((entry) => ({
            date: new Date(entry.createdAt).toISOString(),
          })) || []}
        />
      </div>

      {/* Metrics Section with Toggle Pattern */}
      <div>
        <h3 className="text-lg font-semibold my-4">Metrics</h3>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-6">
          <AnimatePresence mode="popLayout">
            {userMetrics?.map((metric, index) => {
              const entryCount = entries?.filter(
                (e) => e.metricId === metric.id
              ).length || 0;

              return (
                <motion.div
                  key={metric.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{
                    layout: { type: "spring", stiffness: 350, damping: 25 },
                    opacity: { duration: 0.2 },
                    scale: { duration: 0.2 },
                    delay: index * 0.03,
                  }}
                >
                  <MetricCard
                    metric={metric}
                    isSelected={selectedMetricId === metric.id}
                    onSelect={handleMetricSelect}
                    entryCount={entryCount}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Add Metric Button */}
          <Button
            variant="outline"
            className="bg-muted/50 w-full h-20 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 text-muted-foreground"
            onClick={() => setShowMetricRequestPopover(true)}
          >
            <Plus className="h-8 w-8 text-muted-foreground/70" />
          </Button>
        </div>

        {/* Metric Request Popover */}
        <AppleLikePopover
          open={showMetricRequestPopover}
          onClose={() => {
            setShowMetricRequestPopover(false);
            setMetricRequestText("");
          }}
          title="Request a Metric"
        >
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-semibold">Request a New Metric</h2>
            <p className="text-sm text-muted-foreground">
              What metric would you like to track? We'll review your request and consider adding it.
            </p>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Metric description <span className="text-red-500">*</span>
              </label>
              <TextAreaWithVoice
                value={metricRequestText}
                onChange={setMetricRequestText}
                className="w-full px-3 py-2 border border-border rounded-lg min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g., Sleep quality, Stress level, Social interactions..."
              />
            </div>
            <Button
              onClick={async () => {
                if (!metricRequestText.trim()) return;
                await sendFeedback({
                  text: `[Metric Request] ${metricRequestText}`,
                  type: "feature_request",
                  email: currentUser?.email,
                });
                setShowMetricRequestPopover(false);
                setMetricRequestText("");
              }}
              disabled={!metricRequestText.trim() || isSendingFeedback}
              className="w-full"
            >
              {isSendingFeedback ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </AppleLikePopover>

        <Divider />

        {/* Selected Metric Details */}
        <AnimatePresence mode="wait">
          {selectedMetric && (
            <motion.div
              key={selectedMetricId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 mt-6"
            >
              {/* Metric Title */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-4xl">{selectedMetric.emoji}</span>
                <h2 className="text-2xl font-bold">{selectedMetric.title}</h2>
              </div>

              {/* Under seven rated check-ins this card only counts up. */}
              <MetricInsightsCard
                metric={selectedMetric}
                activities={activities}
                activityEntries={activityEntries}
                metricEntries={entries || []}
              />

              {selectedCheckIns.length >= MINIMUM_ENTRIES && (
                <>
                  <MetricTrendCard
                    metric={selectedMetric}
                    entries={selectedCheckIns}
                  />

                  <MetricHeatmap
                    entries={selectedMetricEntries}
                    metricEmoji={selectedMetric.emoji}
                    metricTitle={selectedMetric.title}
                    eventImpacts={selectedMetricEventImpacts}
                  />

                  <DayOfWeekInsights entries={selectedCheckIns} />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
