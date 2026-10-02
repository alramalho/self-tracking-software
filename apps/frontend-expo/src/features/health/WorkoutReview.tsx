import { useState } from "react";
import { Keyboard, View } from "react-native";
import {
  Repeat2,
  Clock3,
  HeartPulse,
  Link2,
  ListFilter,
  Plus,
  Ruler,
  Lock,
  Users,
} from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { EditorButton } from "@/features/activities/editor/controls";
import { ReviewLink, ReviewRow } from "./review/controls";
import type { ReviewPage } from "./review/types";
import { workoutIcon } from "./review/icon";
import { DetectedWorkoutCard } from "./review/DetectedWorkoutCard";
import {
  candidateDateLabel,
  relativeDateLabel,
  timeLabel,
} from "./review/date";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Field, Status, useColors } from "@/components/ui";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { useActivities } from "@/data/queries";
import { api } from "@/data/api";
import type {
  WorkoutReconciliationDecision,
  WorkoutReconciliationPreviewItem,
} from "./workout-types";
import {
  defaultWorkoutSelection,
  workoutEffortLabel,
  workoutHeartRateSummary,
  workoutNeedsMatchChoice,
  workoutQuantity,
} from "./workout-model";

import type { WorkoutReviewProps } from "./types";

export function WorkoutReview({
  item: firstItem,
  items,
  onClose,
}: WorkoutReviewProps) {
  const c = useColors();
  const [queue] = useState(() => [
    firstItem,
    ...(items ?? []).filter(
      (item) => item.healthWorkout.id !== firstItem.healthWorkout.id,
    ),
  ]);
  const [queueIndex, setQueueIndex] = useState(0);
  const item = queue[queueIndex];
  const WorkoutIcon = workoutIcon(item.healthWorkout.activityTypeName);
  const workout = item.healthWorkout;
  const effortSummary = workoutEffortLabel(workout);
  const heartRateSummary = workoutHeartRateSummary(workout);
  const activities = useActivities();
  const client = useQueryClient();
  const [selection, setSelection] = useState(() =>
    defaultWorkoutSelection(item),
  );
  const [useHealth, setUseHealth] = useState(false);
  const [shareHealthData, setShareHealthData] = useState(
    item.shareHealthDataByDefault ?? false,
  );
  const [page, setPage] = useState<ReviewPage>(() =>
    workoutNeedsMatchChoice(item) ? "choose" : "workout",
  );
  const [title, setTitle] = useState(workout.displayName);
  const [measure, setMeasure] = useState<"minutes" | "kilometers" | "sessions">(
    "minutes",
  );
  const action = useMutation({
    mutationFn: async (ignore: boolean) => {
      const decision: WorkoutReconciliationDecision = {
        healthWorkoutId: workout.id,
        action: "ignore",
      };
      if (!ignore) {
        decision.shareHealthData = shareHealthData;
        if (selection.startsWith("entry:")) {
          decision.action = useHealth ? "link_use_health" : "link_keep";
          decision.activityEntryId = selection.slice(6);
        } else {
          decision.action = "import_new";
          if (selection === "create")
            decision.newActivity = { title: title.trim(), measure };
          else decision.activityId = selection.slice(9);
        }
      }
      await api.post("/health/apple/workouts/reconcile", {
        decisions: [decision],
      });
    },
    onSuccess: async () => {
      await Promise.all(
        ["health", "activities", "activity-entries", "timeline", "plans"].map(
          (key) => client.invalidateQueries({ queryKey: [key] }),
        ),
      );
      const nextIndex = queueIndex + 1;
      const next = queue[nextIndex];
      if (!next) {
        onClose();
        return;
      }
      Keyboard.dismiss();
      setQueueIndex(nextIndex);
      setSelection(defaultWorkoutSelection(next));
      setUseHealth(false);
      setShareHealthData(next.shareHealthDataByDefault ?? false);
      setPage(workoutNeedsMatchChoice(next) ? "choose" : "workout");
      setTitle(next.healthWorkout.displayName);
      setMeasure("minutes");
    },
  });
  const entry = item.candidates.find(
    (candidate) => `entry:${candidate.activityEntryId}` === selection,
  );
  const selected =
    activities.data?.find(
      (activity) => `activity:${activity.id}` === selection,
    ) ??
    (selection === `activity:${item.suggestedActivity?.id}`
      ? item.suggestedActivity
      : undefined);
  const quantity = workoutQuantity(
    workout,
    selection === "create" ? measure : (selected?.measure ?? "minutes"),
  );
  const healthQuantity = entry
    ? workoutQuantity(workout, entry.activityMeasure)
    : null;
  const canUseHealth =
    !!entry?.comparison.compatible && healthQuantity !== null;
  const primaryLabel = entry
    ? "Link workout"
    : selection === "create"
      ? "Create and log workout"
      : "Log workout";
  const select = (value: string) => {
    setSelection(value);
    setUseHealth(false);
    setPage("workout");
  };
  const groupStyle = {
    backgroundColor: c.soft,
    borderRadius: 16,
    overflow: "hidden" as const,
  };
  return (
    <LoggingDrawer
      title={
        page === "choose"
          ? "Choose a match"
          : page === "quantity"
            ? "Which amount?"
            : page === "privacy"
              ? "Who can see Watch data?"
              : "Match your workout"
      }
      titleAlign="left"
      testID="health-workout-drawer"
      dismissLabel="Dismiss workout review"
      keyboardToolbar={selection === "create"}
      scrollToEndOnKeyboard={false}
      onClose={() => {
        if (!action.isPending) onClose();
      }}
    >
      {queue.length > 1 && (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Workout review progress"
          accessibilityValue={{
            min: 1,
            max: queue.length,
            now: queueIndex + 1,
            text: `${queueIndex + 1} of ${queue.length}`,
          }}
          style={{ gap: 7 }}
        >
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: "500" }}>
            Workout {queueIndex + 1} of {queue.length}
          </Text>
          <View
            style={{
              backgroundColor: c.soft,
              borderRadius: 2,
              height: 3,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                backgroundColor: c.accent,
                borderRadius: 2,
                height: 3,
                width: `${((queueIndex + 1) / queue.length) * 100}%`,
              }}
            />
          </View>
        </View>
      )}
      {page !== "workout" && (page !== "choose" || !!selection) && (
        <ReviewLink
          label="Back to workout"
          back
          onPress={() => setPage("workout")}
        />
      )}
      {page === "workout" && (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 8,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: c.soft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <WorkoutIcon size={26} color={c.text} strokeWidth={1.6} />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: c.text, fontSize: 19, fontWeight: "600" }}>
                {workout.displayName}
              </Text>
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
                {relativeDateLabel(workout.startAt)} ·{" "}
                {timeLabel(workout.startAt)} ·{" "}
                {Math.round(workout.durationSeconds / 60)} min
                {workout.distanceMeters == null
                  ? ""
                  : ` · ${(workout.distanceMeters / 1000).toFixed(1)} km`}
              </Text>
              {effortSummary && (
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                  {effortSummary}
                </Text>
              )}
              {heartRateSummary && (
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    gap: 5,
                  }}
                >
                  <HeartPulse
                    accessibilityElementsHidden
                    color={c.muted}
                    size={13}
                    strokeWidth={1.8}
                  />
                  <Text
                    style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}
                  >
                    {heartRateSummary}
                  </Text>
                </View>
              )}
            </View>
          </View>
          {item.mismatches
            .filter((m) => m.severity === "conflict")
            .map((m) => (
              <Copy key={m.code}>{m.label}</Copy>
            ))}
          <View style={{ gap: 10 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {entry
                ? "Matches your existing log"
                : selected
                  ? "Log to activity"
                  : selection === "create"
                    ? "Create an activity"
                    : "Choose where this belongs"}
            </Text>
            <View style={groupStyle}>
              <ReviewRow
                title={
                  entry?.activityTitle ??
                  selected?.title ??
                  (selection === "create" ? "New activity" : "Choose a match")
                }
                emoji={entry?.activityEmoji ?? selected?.emoji}
                icon={
                  entry ? Link2 : selection === "create" ? Plus : ListFilter
                }
                detail={
                  entry
                    ? `${entry.quantity} ${entry.activityMeasure} · ${candidateDateLabel(entry.datetime, workout.startAt)}`
                    : selected
                      ? `${quantity} ${selected.measure}`
                      : selection === "create"
                        ? title
                        : "Choose a log or activity"
                }
                label="Change workout match"
                disabled={action.isPending}
                onPress={() => setPage("choose")}
              />
              {entry && (
                <View
                  style={{
                    borderTopWidth: 1,
                    borderColor: c.inputBorder,
                  }}
                >
                  <ReviewRow
                    title={
                      useHealth
                        ? `Use ${healthQuantity} ${entry.activityMeasure} from Apple`
                        : "Keep my logged amount"
                    }
                    detail={
                      useHealth
                        ? "Rounded to whole units"
                        : `${entry.quantity} ${entry.activityMeasure}`
                    }
                    icon={Ruler}
                    label="Change workout amount"
                    disabled={action.isPending}
                    onPress={() => setPage("quantity")}
                  />
                </View>
              )}
              <View
                style={{
                  borderTopWidth: 1,
                  borderColor: c.inputBorder,
                }}
              >
                <ReviewRow
                  title={
                    shareHealthData
                      ? "Share Watch data"
                      : "Watch data stays private"
                  }
                  detail={
                    shareHealthData
                      ? "Visible to people who can see this activity"
                      : "Only you can see heart rate, calories and exact timing"
                  }
                  icon={shareHealthData ? Users : Lock}
                  label="Change Watch data privacy"
                  disabled={action.isPending}
                  onPress={() => setPage("privacy")}
                />
              </View>
            </View>
            {entry && (
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
                Counts once. Your notes and photos stay.
              </Text>
            )}
            {!entry && selected && (
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
                Adds one new log: {quantity} {selected.measure}.
              </Text>
            )}
          </View>
          {selection === "create" && (
            <View style={{ gap: 16 }}>
              <Field
                label="Activity name"
                value={title}
                editable={!action.isPending}
                onChangeText={setTitle}
                inputAccessoryViewID="logging-input-done"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              <View style={{ gap: 8 }}>
                <Text style={{ color: c.muted, fontSize: 13 }}>Measure in</Text>
                <View style={groupStyle}>
                  {(["minutes", "kilometers", "sessions"] as const)
                    .filter((unit) => workoutQuantity(workout, unit) !== null)
                    .map((unit) => (
                      <ReviewRow
                        key={unit}
                        title={unit[0].toUpperCase() + unit.slice(1)}
                        detail={`${workoutQuantity(workout, unit)} ${unit}`}
                        icon={
                          unit === "minutes"
                            ? Clock3
                            : unit === "kilometers"
                              ? Ruler
                              : Repeat2
                        }
                        selected={measure === unit}
                        disabled={action.isPending}
                        onPress={() => setMeasure(unit)}
                      />
                    ))}
                </View>
              </View>
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
                Create {title || "activity"} and log {quantity} {measure}.
              </Text>
            </View>
          )}
          <Status error={action.error} />
          <View style={{ gap: 4, marginTop: 4 }}>
            <EditorButton
              label={primaryLabel}
              icon={entry ? Link2 : Plus}
              busy={action.isPending}
              disabled={
                !selection ||
                (selection === "create" && !title.trim()) ||
                (!entry && quantity === null)
              }
              onPress={() => action.mutate(false)}
            />
            <ReviewLink
              label="Skip this workout"
              disabled={action.isPending}
              onPress={() => action.mutate(true)}
            />
          </View>
        </>
      )}
      {page === "choose" && (
        <View style={{ gap: 20 }}>
          <DetectedWorkoutCard workout={workout} />
          {item.mismatches
            .filter((mismatch) => mismatch.severity === "conflict")
            .map((mismatch) => (
              <Copy key={mismatch.code}>{mismatch.label}</Copy>
            ))}
          {!!item.candidates.length && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: c.muted, fontSize: 13 }}>
                Possible existing logs
              </Text>
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                Link one to avoid logging the same workout twice.
              </Text>
              <View style={groupStyle}>
                {item.candidates.map((candidate) => (
                  <ReviewRow
                    key={candidate.activityEntryId}
                    title={candidate.activityTitle}
                    emoji={candidate.activityEmoji}
                    icon={Link2}
                    detail={`${candidate.quantity} ${candidate.activityMeasure} · ${candidateDateLabel(candidate.datetime, workout.startAt)}`}
                    label={`Match ${candidate.activityTitle} · ${candidate.quantity} ${candidate.activityMeasure} · ${candidateDateLabel(candidate.datetime, workout.startAt)}`}
                    selected={
                      selection === `entry:${candidate.activityEntryId}`
                    }
                    onPress={() => select(`entry:${candidate.activityEntryId}`)}
                  />
                ))}
              </View>
            </View>
          )}
          <View style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              Or create a new log
            </Text>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              Choosing an activity below adds a separate log from this Watch
              workout.
            </Text>
            <Status
              loading={activities.isPending}
              error={activities.error}
              retry={() => void activities.refetch()}
            />
            <View style={groupStyle}>
              {activities.data
                ?.filter(
                  (activity) =>
                    workoutQuantity(workout, activity.measure) !== null,
                )
                .map((activity) => (
                  <ReviewRow
                    key={activity.id}
                    title={activity.title}
                    emoji={activity.emoji}
                    detail={`New log · ${workoutQuantity(workout, activity.measure)} ${activity.measure}`}
                    label={`${activity.emoji} ${activity.title}`}
                    selected={selection === `activity:${activity.id}`}
                    onPress={() => select(`activity:${activity.id}`)}
                  />
                ))}
              <ReviewRow
                title="Create activity"
                detail="Create an activity, then add this workout as its first log"
                icon={Plus}
                onPress={() => select("create")}
              />
            </View>
          </View>
        </View>
      )}
      {page === "quantity" && entry && (
        <>
          <Copy>Choose the amount to keep in your log.</Copy>
          <View style={groupStyle}>
            <ReviewRow
              title={`Keep ${entry.quantity} ${entry.activityMeasure}`}
              detail="Your logged amount"
              selected={!useHealth}
              icon={Link2}
              onPress={() => {
                setUseHealth(false);
                setPage("workout");
              }}
            />
            <ReviewRow
              title={
                canUseHealth
                  ? `Use ${healthQuantity} ${entry.activityMeasure}`
                  : "Connected measurement unavailable"
              }
              detail={
                canUseHealth
                  ? `From ${item.healthWorkout.sourceName ?? (item.healthWorkout.provider === "garmin_connect" ? "Garmin Connect" : "Apple Health")} · rounded to whole units`
                  : "This activity’s unit cannot use the connected measurement."
              }
              selected={useHealth}
              disabled={!canUseHealth}
              icon={Ruler}
              onPress={() => {
                setUseHealth(true);
                setPage("workout");
              }}
            />
          </View>
          <Copy muted>Your notes and photos stay with the log.</Copy>
        </>
      )}
      {page === "privacy" && (
        <>
          <Copy>
            Your activity log keeps its normal visibility. Choose whether its
            Apple Watch details travel with it.
          </Copy>
          <View style={groupStyle}>
            <ReviewRow
              title="Private"
              detail="Only you can see heart rate, calories and exact timing"
              selected={!shareHealthData}
              icon={Lock}
              onPress={() => {
                setShareHealthData(false);
                setPage("workout");
              }}
            />
            <ReviewRow
              title="Share with activity"
              detail="People who can see this activity can also see its Watch details"
              selected={shareHealthData}
              icon={Users}
              onPress={() => {
                setShareHealthData(true);
                setPage("workout");
              }}
            />
          </View>
        </>
      )}
    </LoggingDrawer>
  );
}
