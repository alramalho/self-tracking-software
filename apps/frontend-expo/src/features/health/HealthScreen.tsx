import { useEffect, useRef, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Activity, ChevronRight, Lock } from "lucide-react-native";
import { formatDistanceToNow } from "date-fns";
import { Text } from "@/components/typography/Text";
import {
  Button,
  Copy,
  Heading,
  Panel,
  Screen,
  Status,
  useColors,
} from "@/components/ui";
import { useHealth } from "./HealthProvider";
import { useHealthWorkouts } from "./queries";
import { WorkoutReview } from "./WorkoutReview";
import type { WorkoutReconciliationPreviewItem } from "./workout-types";
import type { GarminStatus, HealthImportStats } from "./types";

export type IntegrationIconProps = {
  size?: number;
  color?: string;
};

export function AppleLogoIcon({ size = 30 }: IntegrationIconProps) {
  const c = useColors();
  return (
    <SymbolView
      accessibilityLabel="Apple logo"
      name="apple.logo"
      size={size}
      tintColor={c.text}
      type="monochrome"
    />
  );
}

export function GarminLogoIcon({ size = 30 }: IntegrationIconProps) {
  return (
    <Image
      accessibilityLabel="Garmin logo"
      source={require("../../../assets/integrations/garmin-mark.png")}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}

function IntegrationIcon({ provider }: { provider: "apple" | "garmin" }) {
  if (provider === "apple") {
    return <AppleLogoIcon size={30} />;
  }

  return <GarminLogoIcon size={30} />;
}

function importedHistoryDays(stats: HealthImportStats | undefined) {
  if (!stats) return null;
  if (stats.dataStartDate && stats.dataEndDate) {
    const start = Date.parse(`${stats.dataStartDate}T00:00:00Z`);
    const end = Date.parse(`${stats.dataEndDate}T00:00:00Z`);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return Math.max(0, Math.floor((end - start) / 86400000) + 1);
    }
  }
  return stats.workoutCount || stats.sleepSampleCount || stats.dailyMetricCount
    ? stats.sleepDayCount || null
    : 0;
}

function importedCoverage(stats: HealthImportStats | undefined) {
  if (!stats?.dataStartDate || !stats.dataEndDate) return null;
  const format = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${format(stats.dataStartDate)} – ${format(stats.dataEndDate)}`;
}

function hasImportedData(stats: HealthImportStats | undefined) {
  return Boolean(
    stats &&
      (stats.workoutCount || stats.sleepSampleCount || stats.dailyMetricCount),
  );
}

function ImportedDataOverview({ stats }: { stats: HealthImportStats }) {
  const c = useColors();
  const days = importedHistoryDays(stats);
  const coverage = importedCoverage(stats);
  return (
    <Panel style={{ gap: 12 }}>
      <Heading>Import summary</Heading>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[
          [stats.workoutCount, "Workouts"],
          [stats.sleepDayCount, "Sleep nights"],
          [stats.dailyMetricCount, "Health metrics"],
        ].map(([value, label]) => (
          <View
            key={label}
            style={{
              flex: 1,
              gap: 2,
              padding: 10,
              borderRadius: 12,
              backgroundColor: c.soft,
            }}
          >
            <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>
              {value}
            </Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
          </View>
        ))}
      </View>
      <Copy muted>
        {coverage
          ? `Coverage: ${coverage}`
          : days
            ? `${days} ${days === 1 ? "day" : "days"} of history imported`
            : "Nothing has been imported yet."}
      </Copy>
    </Panel>
  );
}

/** Garmin sends data to us after the watch syncs; there is nothing to press. */
function GarminDataStatus({ status }: { status: GarminStatus }) {
  const last = status.lastSyncCompletedAt ? new Date(status.lastSyncCompletedAt) : null;
  const line = status.backfillInProgress
    ? "Importing your last 30 days. Garmin sends it over the next few hours."
    : last
      ? `Last data received ${formatDistanceToNow(last, { addSuffix: true })}.`
      : "Waiting for your first Garmin sync. Open Garmin Connect on your phone so your watch syncs.";
  return (
    <View style={{ gap: 4 }}>
      <Copy>{line}</Copy>
      <Copy muted>
        New workouts, sleep and health data arrive automatically a few minutes after your
        watch syncs with Garmin Connect.
      </Copy>
    </View>
  );
}

function WorkoutRow({
  item,
  onPress,
}: {
  item: WorkoutReconciliationPreviewItem;
  onPress: () => void;
}) {
  const c = useColors();
  const workout = item.healthWorkout;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workout.displayName}, ${new Date(workout.startAt).toLocaleDateString()}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 68,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          backgroundColor: c.soft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Activity size={21} color={c.text} strokeWidth={1.7} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: c.text, fontWeight: "600", fontSize: 16 }}>
          {item.resolved?.linkedActivity
            ? `${item.resolved.linkedActivity.emoji} ${item.resolved.linkedActivity.title}`
            : workout.displayName}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>
          {new Date(workout.startAt).toLocaleDateString([], {
            dateStyle: "medium",
          })}{" "}
          · {Math.round(workout.durationSeconds / 60)} min
          {workout.averageHeartRateBpm == null
            ? ""
            : ` · ${Math.round(workout.averageHeartRateBpm)} bpm`}
        </Text>
      </View>
      <ChevronRight size={18} color={c.muted} />
    </Pressable>
  );
}

export function GarminContent() {
  const health = useHealth();
  const [disconnectingGarmin, setDisconnectingGarmin] = useState(false);
  const importStats = health.garmin.status?.importStats;

  return (
    <>
      <Panel style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <IntegrationIcon provider="garmin" />
          <Heading>Garmin Connect</Heading>
          {health.garmin.status?.connected && (
            <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "600" }}>
              Connected
            </Text>
          )}
        </View>
        <Copy muted>
          Sync Garmin workouts, sleep, heart rate, stress and recovery data.
        </Copy>
        {!health.garmin.status?.connected ? (
          <Button
            disabled={!health.garmin.status?.available}
            busy={health.garmin.busy}
            onPress={() => void health.garmin.connect()}
          >
            Connect Garmin Connect
          </Button>
        ) : (
          <GarminDataStatus status={health.garmin.status} />
        )}
        {(health.garmin.status?.connected || hasImportedData(importStats)) &&
          importStats && <ImportedDataOverview stats={importStats} />}
        <Status
          error={health.garmin.error}
        />
      </Panel>

      {(health.garmin.status?.connected ||
        !!health.garmin.status?.importStats.sleepSampleCount) && (
        <Button
          secondary
          disabled={health.garmin.busy}
          onPress={() => setDisconnectingGarmin(!disconnectingGarmin)}
        >
          Disconnect Garmin Connect
        </Button>
      )}
      {disconnectingGarmin && (
        <Panel>
          <Copy>
            Stop syncing Garmin Connect. You can keep the imported history or
            remove Garmin-imported data. Manual logs stay.
          </Copy>
          <Button
            secondary
            busy={health.garmin.busy}
            onPress={() =>
              void health.garmin
                .disconnect(false)
                .then((success) => success && setDisconnectingGarmin(false))
            }
          >
            Disconnect and keep history
          </Button>
          <Button
            danger
            busy={health.garmin.busy}
            onPress={() =>
              void health.garmin
                .disconnect(true)
                .then((success) => success && setDisconnectingGarmin(false))
            }
          >
            Disconnect and remove imported data
          </Button>
        </Panel>
      )}
    </>
  );
}

export function HealthContent({ showGarmin = true }: { showGarmin?: boolean }) {
  const c = useColors();
  const health = useHealth();
  const workouts = useHealthWorkouts();
  const params = useLocalSearchParams<{ review?: string }>();
  const autoOpened = useRef(false);
  const [selected, setSelected] = useState<WorkoutReconciliationPreviewItem>();
  const [disconnecting, setDisconnecting] = useState(false);
  const pending = workouts.data?.items.filter((item) => !item.resolved) ?? [];
  const history = (
    workouts.data?.items.filter((item) => !!item.resolved?.activityEntryId) ??
    []
  )
    .sort(
      (a, b) =>
        new Date(b.healthWorkout.startAt).getTime() -
        new Date(a.healthWorkout.startAt).getTime(),
    )
    .slice(0, 20);

  useEffect(() => {
    if (params.review !== "1" || autoOpened.current || !pending[0]) return;
    autoOpened.current = true;
    setSelected(pending[0]);
  }, [params.review, pending]);

  return (
    <>
      {pending.length > 0 && (
        <Panel style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Activity size={22} color={c.text} />
            <View style={{ flex: 1, gap: 4 }}>
              <Heading>
                {pending.length === 1
                  ? "Workout detected"
                  : `${pending.length} workouts detected`}
              </Heading>
              <Copy muted>
                Review in one continuous flow. The strongest same-day match is
                selected for you.
              </Copy>
            </View>
          </View>
          <Button onPress={() => setSelected(pending[0])}>
            {pending.length === 1
              ? "Review workout"
              : `Review ${pending.length} workouts`}
          </Button>
        </Panel>
      )}

      {(health.enabled || health.status?.connected || health.garmin.status?.connected) && (
        <View style={{ gap: 10 }}>
          <Heading>Workout history</Heading>
          <Copy muted>
            Your linked Apple Watch and Garmin workouts with private vitals.
          </Copy>
          {history.length ? (
            <Panel style={{ gap: 0 }}>
              {history.map((item, index) => (
                <View
                  key={item.healthWorkout.id}
                  style={
                    index
                      ? { borderTopWidth: 1, borderTopColor: c.border }
                      : undefined
                  }
                >
                  <WorkoutRow
                    item={item}
                    onPress={() =>
                      router.push(
                        `/health-workout/${item.healthWorkout.id}` as never,
                      )
                    }
                  />
                </View>
              ))}
            </Panel>
          ) : (
            <Panel>
              <Copy muted>
                Linked workouts will appear here with heart rate, calories,
                distance and effort when your connected device provides them.
              </Copy>
            </Panel>
          )}
          <Status
            loading={workouts.isPending}
            error={workouts.error}
            retry={() => void workouts.refetch()}
          />
        </View>
      )}

      <Panel style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <IntegrationIcon provider="apple" />
          <Heading>Apple Health</Heading>
          {health.status?.connected && (
            <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "600" }}>
              Connected
            </Text>
          )}
        </View>
        <Copy muted>
          Workouts sync when you open the app and whenever iOS gives tracking.so
          background time.
        </Copy>
        {!health.enabled ? (
          <Button
            disabled={!health.available}
            busy={health.busy}
            onPress={() => void health.connect()}
          >
            Connect Apple Health
          </Button>
        ) : (
          <Button busy={health.busy} onPress={() => void health.sync()}>
            Sync now
          </Button>
        )}
        {(health.status?.connected || hasImportedData(health.status?.importStats)) &&
          health.status?.importStats && (
          <ImportedDataOverview stats={health.status.importStats} />
        )}
        {health.status?.connected && (
          <Copy muted>
            Apple Health imports the workouts and sleep data available on this
            iPhone. Tap Sync now after granting access to refresh it.
          </Copy>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Lock size={16} color={c.muted} />
          <View style={{ flex: 1 }}>
            <Copy muted>
              Watch vitals stay private unless you explicitly share them with a
              linked activity.
            </Copy>
          </View>
        </View>
        <Status error={health.error} retry={() => void health.sync()} />
      </Panel>

      {showGarmin && <GarminContent />}

      <Button secondary onPress={() => router.push("/(tabs)/metrics")}>
        View sleep score
      </Button>
      {(health.enabled ||
        health.status?.connected ||
        !!health.status?.importStats.sleepSampleCount) && (
        <Button
          secondary
          disabled={health.busy}
          onPress={() => setDisconnecting(!disconnecting)}
        >
          Disconnect Apple Health
        </Button>
      )}
      {disconnecting && (
        <Panel>
          <Copy>
            Stop syncing on this phone. You can keep the imported history or
            remove Apple-imported data. Your manual logs stay.
          </Copy>
          <Button
            secondary
            busy={health.busy}
            onPress={() =>
              void health
                .disconnect(false)
                .then((success) => success && setDisconnecting(false))
            }
          >
            Disconnect and keep history
          </Button>
          <Button
            danger
            busy={health.busy}
            onPress={() =>
              void health
                .disconnect(true)
                .then((success) => success && setDisconnecting(false))
            }
          >
            Disconnect and remove imported data
          </Button>
        </Panel>
      )}
      {selected && (
        <WorkoutReview
          item={selected}
          items={pending}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  );
}

export default function HealthScreen() {
  return (
    <Screen
      title="Health & workouts"
      leading={
        <Button secondary onPress={() => router.back()}>
          Back
        </Button>
      }
    >
      <HealthContent />
    </Screen>
  );
}
