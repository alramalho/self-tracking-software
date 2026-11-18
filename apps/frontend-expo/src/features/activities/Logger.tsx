import { DifficultyStep } from "./logging/DifficultyStep";
import { CircleIntroHint } from "@/features/circles/CircleIntroHint";
import { LoggingDrawer } from "./logging/LoggingDrawer";
import { PhotoStep } from "./logging/PhotoStep";
import { QuantityStep } from "./logging/QuantityStep";
import { useEffect, useState } from "react";
import { Keyboard } from "react-native";
import * as Location from "expo-location";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { differenceInHours } from "date-fns";
import { Button, Copy, Field, Status } from "@/components/ui";
import { localDateTime, parseLocalDate } from "@/core/dates";
import {
  useAction,
  useCurrentUser,
  usePlans,
  useMetrics,
} from "@/data/queries";
import { api } from "@/data/api";
import { pickPhotos } from "@/native/photos";
import type { ActivityEntry, LogActivityResult, Photo } from "@/core/types";
import { CelebrationOverlay } from "@/features/celebration/CelebrationOverlay";
import { VoiceLogDrawer } from "@/features/voice-log/VoiceLogDrawer";
import type { VoiceLogFollowUp } from "@/features/voice-log/types";
import { dayKey } from "@/core/dates";
import { isLearningPlan } from "@tsw/prisma/follow-through/coverage";
import { celebrationFor, type Celebration } from "@/features/celebration/model";
import { useOfflineLogs } from "@/features/offline/provider";
import { FriendPicker } from "./FriendPicker";
import { MetricLogger } from "../metrics/MetricLogger";
import type { FriendResult, LoggerProps, LogStep } from "./types";
import { useAccessChecklist } from "@/features/access/AccessChecklist";
import { accessRequests } from "@/features/access/model";
export function Logger({ activity, initialDate, initialQuantity, onLogged, onClose }: LoggerProps) {
  const client = useQueryClient();
  const offline = useOfflineLogs();
  const user = useCurrentUser();
  const plans = usePlans();
  const metrics = useMetrics();
  const [step, setStep] = useState<LogStep>("quantity");
  const [sharedSelection, setSharedSelection] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(String(initialQuantity ?? 0));
  const [date, setDate] = useState(localDateTime(initialDate ?? new Date()));
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [friend, setFriend] = useState<FriendResult>();
  const [picking, setPicking] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const access = useAccessChecklist();
  const [error, setError] = useState<unknown>();
  const [result, setResult] = useState<LogActivityResult>();
  const [queuedError, setQueuedError] = useState<string>();
  // The "Nice work!" moment plays first; the usual next step (shared, difficulty, metrics) waits for it.
  const [celebration, setCelebration] = useState<{ value: Celebration; then: () => void }>();
  // "Share more" from the celebration: a voice note about this session (how it felt, what it was about, anything else).
  const [shareMore, setShareMore] = useState<VoiceLogFollowUp>();
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  }>();
  // The celebration is the confirmation now: once nothing else is asked, the logger closes.
  useEffect(() => {
    if (step === "done" && result && !celebration) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, result, celebration]);
  const save = useMutation({
    mutationFn: () =>
      offline.save({
        activityId: activity.id,
        activityTitle: activity.title,
        quantity: Number(quantity),
        datetime: parseLocalDate(date),
        description,
        privateNotes: notes,
        photos,
        onUploadProgress: setUploadProgress,
        withUserId: friend?.userId,
        ...location,
      }),
    onMutate: () => setUploadProgress(undefined),
    onSuccess: async (outcome) => {
      if (outcome.queued || !outcome.result) {
        setQueuedError(outcome.error);
        setStep("queued");
        return;
      }
      const data = outcome.result;
      // This week's earlier logs, without the new one: from the cache, or fetched when this screen never loaded them.
      const cached = client.getQueryData<ActivityEntry[]>(["activity-entries"]);
      const earlier = (
        cached ??
        (await api.get<ActivityEntry[]>("/activities/activity-entries").then((r) => r.data).catch(() => []))
      ).filter((e) => e.id !== data.entry.id);
      const value = celebrationFor({
        activity,
        quantity: Number(quantity),
        datetime: parseLocalDate(date),
        plans: plans.data ?? [],
        entries: earlier,
      });
      setResult(data);
      onLogged?.(data.entry);
      void client.invalidateQueries();
      const then = () => {
        if (data.sharedActivityCandidates?.length) setStep("shared");
        else afterShared();
      };
      setCelebration({ value, then });
    },
  });
  function afterShared() {
    const isPaid = user.data?.planType && user.data.planType !== "FREE";
    const inPlan = plans.data?.some(
      (p) =>
        !p.archivedAt &&
        !p.deletedAt &&
        p.activities.some((a) => a.id === activity.id),
    );
    setStep(
      isPaid &&
        inPlan &&
        differenceInHours(new Date(), parseLocalDate(date)) < 48
        ? "difficulty"
        : nextMetricStep(),
    );
  }
  function nextMetricStep(): LogStep {
    return metrics.data?.length &&
      differenceInHours(new Date(), parseLocalDate(date)) < 6
      ? "metrics"
      : "done";
  }
  const link = useAction(async () => {
    for (const candidate of sharedSelection) {
      await api.post(
        `/activities/activity-entries/${result!.entry.id}/shared-link`,
        { candidateActivityEntryId: candidate },
      );
    }
  });
  async function addPhotos(camera = false) {
    try {
      setError(undefined);
      setPicking(true);
      const picked = await pickPhotos(camera, 10 - photos.length);
      if (photos.length + picked.length > 10)
        throw new Error("Maximum 10 photos allowed");
      setPhotos((p) => [...p, ...picked]);
    } catch (e) {
      setError(e);
    } finally {
      setPicking(false);
    }
  }
  async function getLocation() {
    try {
      await access.ask(accessRequests.logLocation());
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted)
        throw new Error(
          "Location permission was not granted. You can log without a location.",
        );
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch (e) {
      setError(e);
    }
  }
  function next() {
    setError(undefined);
    try {
      if (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0)
        throw new Error("Quantity must be a whole number greater than zero.");
      if (parseLocalDate(date) > new Date())
        throw new Error("Choose a date in the past.");
      Keyboard.dismiss();
      setStep("photos");
    } catch (e) {
      setError(e);
    }
  }
  // Learning plans ask what was covered, so the coach knows where they are in the course.
  const learning = (plans.data ?? []).some(
    (p) => !p.archivedAt && isLearningPlan(p) && p.activities.some((a) => a.id === activity.id),
  );
  if (celebration)
    return (
      <CelebrationOverlay
        celebration={celebration.value}
        shareMoreLabel={learning ? "What did you cover?" : "Share more"}
        onDone={() => {
          const { then } = celebration;
          setCelebration(undefined);
          then();
        }}
        onShareMore={
          result
            ? () => {
                setCelebration(undefined);
                setShareMore({
                  logged: [
                    { activityId: activity.id, date: dayKey(result.entry.datetime), quantity: result.entry.quantity },
                  ],
                });
              }
            : undefined
        }
      />
    );
  // Share more replaces the follow-up questions (difficulty, metrics): the note covers them.
  if (shareMore) return <VoiceLogDrawer followUp={shareMore} onClose={onClose} />;
  if (step === "difficulty" && result)
    return (
      <DifficultyStep
        activity={activity}
        entryId={result.entry.id}
        initialNotes={notes}
        onSkip={() => setStep(nextMetricStep())}
        onSave={async (value, privateNotes) => {
          await api.put(`/activities/activity-entries/${result.entry.id}`, {
            difficulty: value,
            privateNotes,
          });
          void client.invalidateQueries();
          setStep(nextMetricStep());
        }}
      />
    );
  if (step === "metrics")
    return <MetricLogger onClose={() => setStep("done")} />;
  return (
    <LoggingDrawer
      titleAlign={step === "photos" ? "left" : "center"}
      title={
        step === "quantity"
          ? `Log ${activity.title}`
          : step === "photos"
            ? "📸 Add a proof!"
            : step === "queued"
              ? queuedError ? "Saved with a sync issue" : "Saved for sync"
            : step === "shared"
              ? "Did you do this together?"
              : step === "difficulty"
                ? "How did it feel?"
                : "Activity logged!"
      }
      onClose={save.isPending || picking || link.isPending ? () => {} : onClose}
    >
      {step === "quantity" && (
        <QuantityStep
          activity={activity}
          date={date}
          quantity={quantity}
          onDateChange={setDate}
          onQuantityChange={setQuantity}
          onNext={next}
        />
      )}
      {step === "photos" && (
        <PhotoStep
          photos={photos}
          caption={description}
          busy={save.isPending}
          picking={picking}
          uploadProgress={uploadProgress}
          onCaptionChange={setDescription}
          onAddPhotos={(camera) => void addPhotos(camera)}
          onRemovePhoto={(index) =>
            setPhotos(photos.filter((_, i) => i !== index))
          }
          onSave={() => {
            Keyboard.dismiss();
            save.mutate();
          }}
          onBack={() => setStep("quantity")}
        >
          <CircleIntroHint activityId={activity.id} />
          <FriendPicker value={friend} onChange={setFriend} />
          <Field
            label="Private notes"
            multiline
            value={notes}
            onChangeText={setNotes}
            editable={!save.isPending}
          />
          <Button secondary onPress={() => void getLocation()}>
            {location ? "Location added" : "Add location"}
          </Button>
          {access.sheet}
        </PhotoStep>
      )}
      {step === "shared" && (
        <>
          {result?.sharedActivityCandidates.map((candidate) => (
            <Button
              key={candidate.activityEntryId}
              secondary
              disabled={link.isPending}
              onPress={() =>
                setSharedSelection((ids) =>
                  ids.includes(candidate.activityEntryId)
                    ? ids.filter((id) => id !== candidate.activityEntryId)
                    : [...ids, candidate.activityEntryId],
                )
              }
            >{`${sharedSelection.includes(candidate.activityEntryId) ? "✓ " : ""}Together with ${candidate.user.name ?? candidate.user.username}`}</Button>
          ))}
          <Button
            disabled={!sharedSelection.length}
            busy={link.isPending}
            onPress={() => link.mutate(undefined, { onSuccess: afterShared })}
          >
            Link Activities
          </Button>
          <Button secondary disabled={link.isPending} onPress={afterShared}>
            Skip
          </Button>
        </>
      )}
      {step === "done" && (
        <>
          <Copy>
            {activity.emoji} {quantity} {activity.measure} logged.
          </Copy>
          <Button onPress={onClose}>Done</Button>
        </>
      )}
      {step === "queued" && (
        <>
          <Copy>{queuedError
            ? `Your activity is saved on this phone. ${queuedError} Retry from Home or Log.`
            : "Your activity is saved on this phone. It will sync when the connection returns. You can check its progress on Home or Log."}</Copy>
          <Button onPress={onClose}>Done</Button>
        </>
      )}
      <Status error={error ?? save.error ?? link.error} />
    </LoggingDrawer>
  );
}
