import { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Activity, ChevronRight, Lock, Mail } from "lucide-react-native";
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
import type { GarminSyncResult, HealthImportStats } from "./types";

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

function GarminSyncOutcome({
  result,
  backfillInProgress,
}: {
  result: GarminSyncResult | null;
  backfillInProgress: boolean;
}) {
  const c = useColors();
  if (!result) return null;

  const status = result.counts.backfillStatus;
  const error =
    status === "unavailable" ||
    status === "rate_limited" ||
    status === "missing_permission";
  const importing =
    backfillInProgress || status === "accepted" || status === "already_requested";
  const received =
    result.counts.workouts > 0 ||
    result.counts.sleepSamples > 0 ||
    result.counts.dailyMetrics > 0;
  const title = error
    ? status === "rate_limited"
      ? "Garmin is temporarily unavailable"
      : status === "missing_permission"
        ? "Garmin needs permission"
        : "Garmin couldn't import older data"
    : result.counts.workouts > 0
      ? "Garmin sync complete"
      : importing
        ? "Garmin is waiting for older data"
        : "No new Garmin workouts yet";
  const detail = error
    ? status === "rate_limited"
      ? "Try syncing again later."
      : status === "missing_permission"
        ? "Reconnect Garmin and allow data sharing again."
        : "Garmin did not return this data. Try again later."
    : result.counts.workouts > 0
      ? "Your workouts are ready."
      : importing
        ? "Sync your watch in Garmin Connect. Older workouts appear only when Garmin sends them."
        : received
          ? "Sleep and health data were imported, but no workouts arrived this time."
          : "Sync your watch in Garmin Connect, then try again.";
  const tone = error ? (c.dark ? "#f87171" : "#dc2626") : c.text;

  return (
    <View
      accessibilityLabel="Garmin sync status"
      style={{
        gap: 4,
        padding: 12,
        borderRadius: 12,
        backgroundColor: error ? (c.dark ? "#3b1717" : "#fee2e2") : c.soft,
      }}
    >
      <Text style={{ color: tone, fontWeight: "700" }}>{title}</Text>
      <Copy muted>{detail}</Copy>
      <Copy muted>
        This sync: {result.counts.workouts} workouts · {result.counts.sleepSamples} sleep records · {result.counts.dailyMetrics} health values
      </Copy>
    </View>
  );
}

function GarminSupportRequest({
  busy,
  onSync,
}: {
  busy: boolean;
  onSync: () => Promise<void>;
}) {
  const c = useColors();
  const [draftOpened, setDraftOpened] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState<unknown>();

  async function openSupportEmail() {
    const subject = "Please resend my missing Garmin workouts";
    const body = [
      "Hello Garmin Support,",
      "",
      "Please resend the Garmin workouts missing from my tracking.so account. My Garmin Connect account is already connected to tracking.so and the required permission has already been granted.",
      "",
      "Please resend the missing workouts from the last 180 days.",
      "",
      "Please confirm when the resend is complete. I will then open tracking.so and check my imported workouts.",
      "",
      "Thank you.",
    ].join("\n");

    try {
      setError(undefined);
      await Linking.openURL(
        `mailto:connect-support@developer.garmin.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      );
      setDraftOpened(true);
    } catch (failure) {
      setError(failure);
    }
  }

  return (
    <Panel style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Mail size={22} color={c.text} />
        <Heading>Recover missing Garmin workouts</Heading>
      </View>
      <Copy muted>
        Your Garmin connection is active, but some older workouts are missing.
        We’ll open a short request asking Garmin to resend them.
      </Copy>
      {!requestSent ? (
        <>
          <Button secondary onPress={() => void openSupportEmail()}>
            Ask Garmin to resend
          </Button>
          {draftOpened && (
            <View style={{ gap: 10 }}>
              <Copy muted>
                Your email app is ready. Review the short request, send it, then
                mark it sent below.
              </Copy>
              <Button secondary onPress={() => setRequestSent(true)}>
                I sent the request
              </Button>
            </View>
          )}
        </>
      ) : (
        <View
          style={{
            gap: 10,
            padding: 12,
            borderRadius: 12,
            backgroundColor: c.soft,
          }}
        >
          <Text style={{ color: "#22c55e", fontWeight: "700" }}>
            Request sent
          </Text>
          <Copy muted>
            After Garmin confirms the resend, return here and tap Check
            imported data. The workout count will update automatically.
          </Copy>
          <Button secondary busy={busy} onPress={() => void onSync()}>
            Check imported data
          </Button>
        </View>
      )}
      <Status error={error} retry={() => void openSupportEmail()} />
    </Panel>
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
  const latestSync = health.garmin.lastSyncResult;
  const needsGarminSupport =
    !!health.garmin.status?.connected &&
    !importStats?.workoutCount &&
    !!(latestSync || health.garmin.status.lastSyncCompletedAt);

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
          <Button
            busy={health.garmin.busy}
            onPress={() => void health.garmin.sync()}
          >
            Sync Garmin now
          </Button>
        )}
        <GarminSyncOutcome
          result={latestSync}
          backfillInProgress={!!health.garmin.status?.backfillInProgress}
        />
        {(health.garmin.status?.connected || hasImportedData(importStats)) &&
          importStats && <ImportedDataOverview stats={importStats} />}
        {needsGarminSupport && (
          <GarminSupportRequest
            busy={health.garmin.busy}
            onSync={health.garmin.sync}
          />
        )}
        {health.garmin.status?.connected && (
          <Copy muted>
            To import new workouts, sync the watch in Garmin Connect first,
            then tap Sync Garmin now. The Garmin app cannot force a historical
            replay of older workouts.
          </Copy>
        )}
        <Status
          error={health.garmin.error}
          retry={() => void health.garmin.sync()}
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
