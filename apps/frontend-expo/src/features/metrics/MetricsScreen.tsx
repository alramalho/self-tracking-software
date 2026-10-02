import { Reveal } from "@/components/reveal/Reveal";
import { MetricInsights } from "./MetricInsights";
import { useRefresh } from "@/data/useRefresh";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/typography/Text";
import { Check, Plus, HeartPulse } from "lucide-react-native";
import { format, subDays } from "date-fns";
import {
  Button,
  Copy,
  Field,
  Heading,
  IconButton,
  Panel,
  Screen,
  Sheet,
  Status,
  useColors,
} from "@/components/ui";
import {
  useAction,
  useContextEvents,
  useActivities,
  useCurrentUser,
  useEntries,
  useMetrics,
  useMetricEntries,
} from "@/data/queries";
import { api } from "@/data/api";
import { dayKey } from "@/core/dates";
import {
  activityFindings,
  metricDayKey,
  sleepFinding,
  validRatings,
} from "./model";
import { getMetricEventImpacts } from "./analysis";
import { MetricLogger } from "./MetricLogger";
import { MetricHeatmap } from "./MetricHeatmap";
import { MetricTrend } from "./MetricTrend";
import { DayPatterns } from "./DayPatterns";
import { HealthOverview } from "@/features/health/HealthOverview";
import { useSleepScores } from "@/features/health/queries";

type MetricsView = "health" | "checkins";

const pill = {
  minHeight: 40,
  paddingHorizontal: 14,
  borderRadius: 20,
  borderWidth: 1,
  alignItems: "center",
  justifyContent: "center",
} as const;

export default function MetricsScreen() {
  const metrics = useMetrics();
  const entries = useMetricEntries();
  const events = useContextEvents();
  const activities = useActivities();
  const activityEntries = useEntries();
  const sleepScores = useSleepScores();
  const user = useCurrentUser();
  const c = useColors();
  const { refresh, refreshing } = useRefresh(
    "health",
    "metrics",
    "metric-entries",
    "activities",
    "activity-entries",
    "context-events",
  );
  const [selected, setSelected] = useState<string>();
  const [checkin, setCheckin] = useState(false);
  const [request, setRequest] = useState(false);
  const [requestText, setRequestText] = useState("");
  const [view, setView] = useState<MetricsView>("checkins");
  useEffect(() => {
    if (!selected && metrics.data?.length) setSelected(metrics.data[0].id);
  }, [metrics.data, selected]);
  const metric = metrics.data?.find((m) => m.id === selected);
  const selectedEntries = useMemo(
    () =>
      validRatings(entries.data?.filter((e) => e.metricId === selected) ?? []),
    [entries.data, selected],
  );
  const eventImpacts = useMemo(
    () =>
      selected
        ? getMetricEventImpacts(selected, selectedEntries, events.data ?? [])
        : [],
    [selected, selectedEntries, events.data],
  );
  const findings = useMemo(
    () =>
      activityFindings(
        entries.data?.filter((entry) => entry.metricId === selected) ?? [],
        activities.data ?? [],
        activityEntries.data ?? [],
      ),
    [entries.data, selected, activities.data, activityEntries.data],
  );
  const sleep = useMemo(
    () =>
      sleepFinding(
        sleepScores.data?.scores ?? [],
        entries.data?.filter((entry) => entry.metricId === selected) ?? [],
      ),
    [sleepScores.data, entries.data, selected],
  );
  const sendRequest = useAction(async () => {
    const form = new FormData();
    form.append("email", user.data?.email ?? "");
    form.append("text", `[Metric Request] ${requestText.trim()}`);
    form.append("type", "feature_request");
    await api.post("/users/report-feedback", form);
  });
  const start = useAction(async () => {
    for (const metric of [
      { title: "Happiness", emoji: "😊" },
      { title: "Energy", emoji: "⚡️" },
      { title: "Productivity", emoji: "📈" },
    ]) {
      if (!metrics.data?.some((existing) => existing.title === metric.title))
        await api.post("/metrics", metric);
    }
  });
  return (
    <Screen
      testID="metrics-screen"
      title="Metrics"
      actions={
        <IconButton
          label="Manage health data"
          icon={HeartPulse}
          onPress={() => router.push("/health")}
        />
      }
      onRefresh={refresh}
      refreshing={refreshing}
    >
      <Panel
        testID="metrics-view-switcher"
        style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 14 }}
      >
        {(["checkins", "health"] as const).map((option) => {
          const selectedView = view === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={option === "health" ? "Health" : "Check-ins"}
              accessibilityState={{ selected: selectedView }}
              onPress={() => setView(option)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 40,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selectedView ? c.selectedBg : "transparent",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: selectedView ? c.text : c.muted,
                  fontWeight: selectedView ? "600" : "500",
                }}
              >
                {option === "health" ? "Health" : "Check-ins"}
              </Text>
            </Pressable>
          );
        })}
      </Panel>
      {view === "health" ? <HealthOverview /> : (
        <>
      <Reveal id="metrics-checkins" style={{ gap: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 4,
          }}
        >
          {Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i)).map(
            (date, index) => {
              const logged = entries.data?.some(
                (entry) => metricDayKey(entry.createdAt) === dayKey(date),
              );
              return (
                <View
                  key={dayKey(date)}
                  style={{ alignItems: "center", gap: 4 }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      borderWidth: 2,
                      borderColor: logged ? "#22c55e" : c.muted,
                      backgroundColor: logged ? "#22c55e" : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {logged && <Check size={20} color="white" />}
                  </View>
                  <Text style={{ fontSize: 12, color: c.muted }}>
                    {index === 6 ? "Today" : format(date, "EEE")}
                  </Text>
                </View>
              );
            },
          )}
        </View>
        <Button secondary onPress={() => setCheckin(true)}>
          Log Check-in
        </Button>
      </Reveal>
      <Status
        loading={metrics.isPending || entries.isPending}
        error={metrics.error ?? entries.error}
        retry={() => {
          void metrics.refetch();
          void entries.refetch();
        }}
      />
      {metrics.data?.length === 0 && (
        <Panel>
          <Heading>See which habits go with your best days</Heading>
          <Copy>
            Check in on your happiness, energy and productivity, and the
            patterns show up here.
          </Copy>
          <Button busy={start.isPending} onPress={() => start.mutate()}>
            Add default metrics
          </Button>
          <Status error={start.error} />
        </Panel>
      )}
      <Reveal id="metrics-selector" delay={50}>
        {/* One row that scrolls sideways: three metric names do not fit a phone. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
        {metrics.data?.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={m.title}
            accessibilityState={{ selected: selected === m.id }}
            onPress={() => setSelected(m.id)}
            style={{
              ...pill,
              borderColor: selected === m.id ? c.selectedBorder : c.border,
              backgroundColor: selected === m.id ? c.selectedBg : c.card,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                color: selected === m.id ? c.text : c.muted,
                fontWeight: selected === m.id ? "600" : "500",
              }}
            >
              {m.emoji} {m.title}
            </Text>
          </Pressable>
        ))}
        {!!metrics.data?.length && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add Metric"
            onPress={() => setRequest(true)}
            style={{ ...pill, borderStyle: "dashed", borderColor: c.border }}
          >
            <Plus size={18} color={c.muted} />
          </Pressable>
        )}
        </ScrollView>
      </Reveal>
      {metric && (
        <View key={metric.id} style={{ gap: 16 }}>
          <Reveal
            key={`insights-${metric.id}`}
            id={`metrics-insights-${metric.id}`}
          >
            <MetricInsights
              metric={metric}
              checkIns={selectedEntries.length}
              findings={findings}
              sleep={sleep}
            />
          </Reveal>
          {selectedEntries.length >= 7 && (
            <>
              <Reveal id={`metrics-trend-${metric.id}`}>
                <MetricTrend metric={metric} entries={selectedEntries} />
              </Reveal>
              <Reveal id={`metrics-grid-${metric.id}`}>
                <MetricHeatmap
                  metric={metric}
                  entries={selectedEntries}
                  eventImpacts={eventImpacts}
                />
              </Reveal>
              <Reveal id={`metrics-days-${metric.id}`}>
                <DayPatterns metric={metric} entries={selectedEntries} />
              </Reveal>
            </>
          )}
        </View>
      )}
      {checkin && <MetricLogger onClose={() => setCheckin(false)} />}
      <Sheet
        visible={request}
        title="Request a Metric"
        onClose={() => setRequest(false)}
      >
        <Heading>Request a New Metric</Heading>
        <Copy muted>
          What metric would you like to track? We'll review your request and
          consider adding it.
        </Copy>
        <Field
          label="Metric description"
          placeholder="e.g., Sleep quality, Stress level, Social interactions..."
          multiline
          value={requestText}
          onChangeText={setRequestText}
        />
        <Status error={sendRequest.error} />
        <Button
          busy={sendRequest.isPending}
          disabled={!requestText.trim()}
          onPress={() =>
            sendRequest.mutate(undefined, {
              onSuccess: () => {
                setRequest(false);
                setRequestText("");
              },
            })
          }
        >
          Send Request
        </Button>
      </Sheet>
        </>
      )}
    </Screen>
  );
}
