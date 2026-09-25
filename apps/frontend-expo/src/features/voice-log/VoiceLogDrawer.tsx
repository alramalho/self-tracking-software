import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Lightbulb,
  LockKeyhole,
  Mic,
  RotateCcw,
  Square,
  Sparkles,
} from "lucide-react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { Text } from "@/components/typography/Text";
import { Button, Copy, Status, useColors } from "@/components/ui";
import { ReviewRow } from "@/features/health/review/controls";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { useCurrentUser, useEntries } from "@/data/queries";
import { useAiConsent } from "@/features/ai-consent/AiConsent";
import { commitVoiceLog, previewVoiceLog } from "./service";
import { enrichVoiceLogPreview } from "./model";
import { clearPendingVoiceLog, writePendingVoiceLog } from "./storage";
import { useVoiceLogRecorder } from "./useVoiceLogRecorder";
import { voiceLogActivityKey, voiceLogMetricKey } from "./types";
import type {
  VoiceLogDraft,
  VoiceLogDrawerProps,
  VoiceLogPhase,
  VoiceLogPreview,
  VoiceLogRecordingKind,
  VoiceLogSelectionGroupProps,
} from "./types";

function durationLabel(durationMillis: number) {
  const seconds = Math.floor(durationMillis / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function dateLabel(date: string, time?: string | null) {
  const value = new Date(`${date}T${time ?? "12:00"}:00`);
  const formatted = Number.isNaN(value.getTime())
    ? date
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(value);
  return time ? `${formatted} · ${time}` : formatted;
}

function activityDetail(activity: VoiceLogPreview["activities"][number]) {
  return [
    `${activity.quantity} ${activity.measure} · ${dateLabel(activity.date, activity.time)}`,
    activity.description,
    activity.privateNotes ? `Private note: ${activity.privateNotes}` : undefined,
    activity.difficulty ? `Effort: ${activity.difficulty.replaceAll("_", " ")}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}

function metricDetail(metric: VoiceLogPreview["metrics"][number]) {
  return [
    `Rating ${metric.rating}/5 · ${dateLabel(metric.date)}`,
    metric.description,
  ]
    .filter(Boolean)
    .join(" · ");
}

function normalizedText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function isCoachContextItem(
  item: VoiceLogPreview["unresolved"][number],
) {
  return /\b(?:next time|future|intention|goal|plan|coach|context|remember)\b/i.test(
    `${item.text} ${item.reason}`,
  );
}

function SelectionGroup({ children }: VoiceLogSelectionGroupProps) {
  const c = useColors();
  return (
    <View
      style={{
        backgroundColor: c.soft,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

export function VoiceLogDrawer({
  onClose,
  initialDraft,
  onPendingChange,
}: VoiceLogDrawerProps) {
  const c = useColors();
  const client = useQueryClient();
  const user = useCurrentUser(true);
  const entries = useEntries();
  const aiConsent = useAiConsent();
  const [phase, setPhase] = useState<VoiceLogPhase>(
    initialDraft ? "review" : "ready",
  );
  const [preview, setPreview] = useState<VoiceLogPreview | undefined>(
    initialDraft?.preview,
  );
  const [selectedActivityIDs, setSelectedActivityIDs] = useState<Set<string>>(
    () => new Set(initialDraft?.selectedActivityKeys ?? []),
  );
  const [selectedMetricIDs, setSelectedMetricIDs] = useState<Set<string>>(
    () => new Set(initialDraft?.selectedMetricKeys ?? []),
  );
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    initialDraft?.selectedPlanId !== undefined
      ? initialDraft.selectedPlanId
      : initialDraft?.preview.planMatches?.[0]?.planId ?? null,
  );
  const [error, setError] = useState<unknown>();
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [clientRequestId, setClientRequestId] = useState(
    () => initialDraft?.preview.clientRequestId ?? randomUUID(),
  );
  const recordingKindRef = useRef<VoiceLogRecordingKind>("initial");
  const discardedDraftClientRequestIdRef = useRef<string | undefined>(undefined);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (
      !initialDraft ||
      preview ||
      discardedDraftClientRequestIdRef.current ===
        initialDraft.preview.clientRequestId
    )
      return;
    setPreview(initialDraft.preview);
    setPhase("review");
  }, [initialDraft, preview]);

  useEffect(() => {
    setTranscriptExpanded(false);
  }, [preview?.clientRequestId, preview?.transcript]);

  useEffect(() => {
    if (phase !== "review" || !preview) return;
    const draft: VoiceLogDraft = {
      preview,
      selectedActivityKeys: [...selectedActivityIDs],
      selectedMetricKeys: [...selectedMetricIDs],
      selectedPlanId,
      savedAt: new Date().toISOString(),
    };
    void writePendingVoiceLog(draft)
      .then(() => onPendingChange?.(draft))
      .catch((nextError) => setError(nextError));
  }, [
    onPendingChange,
    phase,
    preview,
    selectedActivityIDs,
    selectedMetricIDs,
    selectedPlanId,
  ]);

  const processRecording = useCallback(
    async (uri: string) => {
      const activeRecordingKind = recordingKindRef.current;
      const refinementContext =
        activeRecordingKind === "refinement" && preview
          ? {
              originalTranscript: preview.transcript,
              currentDraft: {
                ...preview,
                activities: preview.activities.filter((activity) =>
                  selectedActivityIDs.has(voiceLogActivityKey(activity)),
                ),
                metrics: preview.metrics.filter((metric) =>
                  selectedMetricIDs.has(voiceLogMetricKey(metric)),
                ),
              },
            }
          : undefined;
      setPhase("processing");
      setError(undefined);
      try {
        const result = await previewVoiceLog(uri, {
          timezone,
          clientRequestId,
          refinementContext,
        });
        const enriched = enrichVoiceLogPreview(result, entries.data ?? []);
        setPreview(enriched);
        setSelectedActivityIDs(
          new Set(enriched.activities.map(voiceLogActivityKey)),
        );
        setSelectedMetricIDs(
          new Set(enriched.metrics.map(voiceLogMetricKey)),
        );
        setSelectedPlanId(enriched.planMatches?.[0]?.planId ?? null);
        setPhase("review");
      } catch (nextError) {
        setError(nextError);
        setPhase(activeRecordingKind === "refinement" ? "review" : "ready");
      }
    },
    [
      clientRequestId,
      preview,
      entries.data,
      selectedActivityIDs,
      selectedMetricIDs,
      timezone,
    ],
  );

  const handleRecordingError = useCallback(
    (nextError: unknown) => {
      setError(nextError);
      setPhase(
        recordingKindRef.current === "refinement" && preview
          ? "review"
          : "ready",
      );
    },
    [preview],
  );

  const handleRecordingReady = useCallback(
    (uri: string) => void processRecording(uri),
    [processRecording],
  );

  const recorder = useVoiceLogRecorder({
    onRecordingReady: handleRecordingReady,
    onError: handleRecordingError,
  });

  const busy =
    recorder.isWorking || phase === "processing" || phase === "committing";
  const isCommitting = phase === "committing";
  const strategist = user.data?.coachPersonality === "STRATEGIST";
  const coachName = strategist ? "Oli" : "Helly";
  const transcriptIsLong = !!preview && preview.transcript.length > 180;
  const noteRepeatsTranscript =
    !!preview && normalizedText(preview.note.text) === normalizedText(preview.transcript);
  const coachContextItems =
    preview?.unresolved.filter(isCoachContextItem) ?? [];
  const planMatch = preview?.planMatches?.[0];
  const personalCoachContextItems = coachContextItems.filter(
    (item) => !planMatch || normalizedText(item.text) !== normalizedText(planMatch.contextText),
  );
  const notIncludedItems =
    preview?.unresolved.filter((item) => !isCoachContextItem(item)) ?? [];

  function close() {
    if (busy || phase === "recording") return;
    onClose();
  }

  async function startRecording(kind: VoiceLogRecordingKind = recordingKindRef.current) {
    // Voice notes are transcribed and read by AI providers, so ask first.
    if (!(await aiConsent.ask())) return;
    setError(undefined);
    recordingKindRef.current = kind;
    setPhase("recording");
    await recorder.start();
  }

  function toggleActivity(id: string) {
    setSelectedActivityIDs((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMetric(id: string) {
    setSelectedMetricIDs((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function startOver() {
    if (busy) return;
    const draftClientRequestId =
      preview?.clientRequestId ?? initialDraft?.preview.clientRequestId;
    if (draftClientRequestId) {
      discardedDraftClientRequestIdRef.current = draftClientRequestId;
    }
    setPreview(undefined);
    setError(undefined);
    setClientRequestId(randomUUID());
    recordingKindRef.current = "initial";
    setSelectedActivityIDs(new Set());
    setSelectedMetricIDs(new Set());
    setSelectedPlanId(null);
    setPhase("ready");
    try {
      await clearPendingVoiceLog();
      onPendingChange?.(null);
    } catch (nextError) {
      setError(nextError);
    }
  }

  function createPlan(suggestion: NonNullable<VoiceLogPreview["planSuggestions"]>[number]) {
    close();
    router.push({
      pathname: "/create-plan",
      params: { voiceGoal: suggestion.text },
    });
  }

  function askCoach(suggestion: NonNullable<VoiceLogPreview["planSuggestions"]>[number]) {
    close();
    router.push({
      pathname: "/messages",
      params: {
        prompt: `I mentioned this longer-term intention in my voice note: “${suggestion.text}” Please help me decide whether it should become a plan, and ask me the next question before creating anything.`,
      },
    });
  }

  function makeChanges() {
    if (!preview || busy) return;
    void startRecording("refinement");
  }

  async function commit() {
    if (!preview || busy) return;
    setPhase("committing");
    setError(undefined);
    try {
      const selectedPlanMatch = preview.planMatches?.find(
        (match) => match.planId === selectedPlanId,
      );
      await commitVoiceLog({
        clientRequestId,
        transcript: preview.transcript,
        timezone,
        activities: preview.activities
          .filter((activity) =>
            selectedActivityIDs.has(voiceLogActivityKey(activity)),
          )
          .map(({ confidence: _confidence, title: _title, emoji: _emoji, measure: _measure, ...activity }) => activity),
        metrics: preview.metrics
          .filter((metric) => selectedMetricIDs.has(voiceLogMetricKey(metric)))
          .map(({ confidence: _confidence, title: _title, emoji: _emoji, ...metric }) => metric),
        note: preview.note,
        planContextPlanId: selectedPlanMatch?.planId ?? null,
        planContextActivityId: selectedPlanMatch?.activityId ?? null,
        planContextText: selectedPlanMatch?.contextText ?? null,
      });
      await client.invalidateQueries();
      await clearPendingVoiceLog();
      onPendingChange?.(null);
      setPhase("committed");
    } catch (nextError) {
      setError(nextError);
      setPhase("review");
    }
  }

  const title =
    phase === "review"
      ? "Review voice note"
      : phase === "processing"
        ? "Understanding your note"
        : phase === "committing"
          ? "Saving voice note"
          : phase === "committed"
            ? "Voice note saved"
            : phase === "recording"
              ? "Recording"
              : "Log voice note";

  return (
    <LoggingDrawer
      title={title}
      titleAlign={phase === "review" ? "left" : "center"}
      testID="voice-log-drawer"
      dismissLabel="Dismiss voice note"
      onClose={close}
    >
      {phase === "ready" && (
        <View testID="voice-log-ready" style={{ gap: 18 }}>
          <View style={{ alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.accent + "18",
              }}
            >
              <Mic size={30} color={c.accent} strokeWidth={1.8} />
            </View>
            <Copy>
              Say what you did, how you felt, or what you want to remember.
              tracking.so will turn it into suggestions for you to review.
            </Copy>
          </View>
          <View
            style={{
              gap: 5,
              padding: 14,
              borderRadius: 14,
              backgroundColor: c.soft,
              borderWidth: 1,
              borderColor: c.inputBorder,
            }}
          >
            <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>
              Private until you save
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
              Nothing is logged automatically. You can remove any suggestion
              before confirming.
            </Text>
          </View>
          <Button onPress={() => void startRecording()}>
            Start recording
          </Button>
          <Text style={{ color: c.muted, textAlign: "center", fontSize: 12 }}>
            Up to 90 seconds · You can start over and record again anytime
          </Text>
          <Status error={error} />
        </View>
      )}

      {phase === "recording" && (
        <View testID="voice-log-recording" style={{ alignItems: "center", gap: 16 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#ef44441a",
            }}
          >
            <Mic size={30} color="#ef4444" strokeWidth={1.8} />
          </View>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
            {recorder.isWorking ? "Finishing recording…" : "Listening…"}
          </Text>
          <Text
            accessibilityLabel="Voice note duration"
            style={{
              color: c.text,
              fontSize: 30,
              fontFamily: "Inter-Bold",
              fontVariant: ["tabular-nums"],
            }}
          >
            {durationLabel(recorder.durationMillis)}
          </Text>
          <Copy muted>
            {recorder.isWorking
              ? "Preparing your note…"
              : "Tap stop when you’re done. The maximum is 90 seconds."}
          </Copy>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
            accessibilityState={{ disabled: recorder.isWorking }}
            disabled={recorder.isWorking}
            onPress={() => void recorder.stop()}
            style={({ pressed }) => ({
              minHeight: 48,
              width: "100%",
              borderRadius: 16,
              backgroundColor: "#ef4444",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: recorder.isWorking ? 0.55 : pressed ? 0.75 : 1,
            })}
          >
            {recorder.isWorking ? (
              <ActivityIndicator color="white" />
            ) : (
              <Square size={15} color="white" fill="white" />
            )}
            <Text style={{ color: "white", fontWeight: "600" }}>
              {recorder.isWorking ? "Finishing…" : "Stop recording"}
            </Text>
          </Pressable>
          <Status error={error} />
        </View>
      )}

      {phase === "processing" && (
        <View testID="voice-log-processing" style={{ alignItems: "center", gap: 14, paddingVertical: 24 }}>
          <ActivityIndicator color={c.accent} />
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
            Transcribing and finding suggestions…
          </Text>
          <Copy muted>
            We’ll show you exactly what was found before anything is saved.
          </Copy>
        </View>
      )}

      {phase === "review" && preview && (
        <View testID="voice-log-review" style={{ gap: 20 }}>
          <View testID="voice-log-heard" style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c.soft,
                  borderWidth: 1,
                  borderColor: c.inputBorder,
                }}
              >
                <Image
                  accessibilityLabel={`${coachName}, your coach`}
                  source={
                    strategist
                      ? require("../../../assets/coaches/oli.png")
                      : require("../../../assets/coaches/helly.png")
                  }
                  style={{ width: 34, height: 34 }}
                  resizeMode="contain"
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>
                  What I heard
                </Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {coachName}’s read on your note
                </Text>
              </View>
            </View>
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 15,
                borderRadius: 18,
                borderTopLeftRadius: 6,
                backgroundColor: c.soft,
                borderWidth: 1,
                borderColor: c.inputBorder,
              }}
            >
              <View style={{ position: "relative" }}>
                <Text
                  numberOfLines={
                    transcriptExpanded || !transcriptIsLong ? undefined : 2
                  }
                  style={{ color: c.text, lineHeight: 23, fontSize: 16 }}
                >
                  “{preview.transcript}”
                </Text>
                {!transcriptExpanded && transcriptIsLong && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 28,
                    }}
                  >
                    <Svg width="100%" height="100%">
                      <Defs>
                        <LinearGradient
                          id="voice-log-transcript-fade"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <Stop offset="0" stopColor={c.soft} stopOpacity={0} />
                          <Stop offset="0.6" stopColor={c.soft} stopOpacity={0.8} />
                          <Stop offset="1" stopColor={c.soft} stopOpacity={1} />
                        </LinearGradient>
                      </Defs>
                      <Rect
                        width="100%"
                        height="100%"
                        fill="url(#voice-log-transcript-fade)"
                      />
                    </Svg>
                  </View>
                )}
              </View>
              {transcriptIsLong && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    transcriptExpanded ? "Show less" : "Show more"
                  }
                  onPress={() => setTranscriptExpanded((value) => !value)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-start",
                    gap: 4,
                    paddingTop: 8,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600" }}>
                    {transcriptExpanded ? "Show less" : "Show more"}
                  </Text>
                  {transcriptExpanded ? (
                    <ChevronUp size={14} color={c.muted} />
                  ) : (
                    <ChevronDown size={14} color={c.muted} />
                  )}
                </Pressable>
              )}
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                paddingHorizontal: 2,
              }}
            >
              <CheckCircle2 size={14} color={c.muted} strokeWidth={1.8} />
              <Text style={{ color: c.muted, fontSize: 12, opacity: 0.82 }}>
                Review the suggestions below. Nothing is saved until you confirm.
              </Text>
            </View>
          </View>

          <View testID="voice-log-extracted" style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sparkles size={17} color={c.accent} strokeWidth={1.8} />
              <View style={{ gap: 2 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>
                  What I extracted
                </Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  Suggestions from what you said
                </Text>
              </View>
            </View>
            <View
              style={{
                marginLeft: 8,
                paddingLeft: 12,
                borderLeftWidth: 1,
                borderLeftColor: c.inputBorder,
                gap: 14,
              }}
            >
              {!!preview.activities.length && (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
                    Activities
                  </Text>
                  <SelectionGroup>
                    {preview.activities.map((activity) => {
                      const id = voiceLogActivityKey(activity);
                      const selected = selectedActivityIDs.has(id);
                      return (
                        <ReviewRow
                          key={id}
                          title={`${activity.emoji} ${activity.title}`}
                          detail={activityDetail(activity)}
                          label={`${selected ? "Remove" : "Include"} ${activity.title}`}
                          selected={selected}
                          onPress={() => toggleActivity(id)}
                        />
                      );
                    })}
                  </SelectionGroup>
                </View>
              )}

              {!!preview.alreadyLogged?.length && (
                <View style={{ gap: 8 }} testID="voice-log-already-logged">
                  <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
                    Already logged
                  </Text>
                  <SelectionGroup>
                    {preview.alreadyLogged.map((activity) => (
                      <ReviewRow
                        key={`${voiceLogActivityKey(activity)}-existing`}
                        title={`${activity.emoji} ${activity.title}`}
                        detail={`${activity.existingQuantity} ${activity.measure} already saved · ${dateLabel(activity.date, activity.time)}`}
                        label={`${activity.title} already logged`}
                        selected
                        disabled
                        onPress={() => {}}
                      />
                    ))}
                  </SelectionGroup>
                  <Copy muted>
                    We left these out so the same session is not counted twice.
                  </Copy>
                </View>
              )}

              {!!preview.metrics.length && (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
                    Metrics
                  </Text>
                  <SelectionGroup>
                    {preview.metrics.map((metric) => {
                      const id = voiceLogMetricKey(metric);
                      const selected = selectedMetricIDs.has(id);
                      return (
                        <ReviewRow
                          key={id}
                          title={`${metric.emoji} ${metric.title}`}
                          detail={metricDetail(metric)}
                          label={`${selected ? "Remove" : "Include"} ${metric.title}`}
                          selected={selected}
                          onPress={() => toggleMetric(id)}
                        />
                      );
                    })}
                  </SelectionGroup>
                </View>
              )}
            </View>
          </View>

          {!!preview.planSuggestions?.length && (
            <View
              testID="voice-log-plan-suggestion"
              style={{
                gap: 10,
                padding: 16,
                borderRadius: 18,
                backgroundColor: c.accent + "12",
                borderWidth: 1,
                borderColor: c.accent + "55",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Lightbulb size={18} color={c.accent} />
                <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
                  This could become a plan
                </Text>
              </View>
              <Copy>
                You mentioned a longer-term intention. It is not logged as a
                completed activity.
              </Copy>
              {preview.planSuggestions.slice(0, 1).map((suggestion) => (
                <View key={`${suggestion.activityId}-${suggestion.text}`} style={{ gap: 8 }}>
                  <Text style={{ color: c.text, lineHeight: 21 }}>
                    {suggestion.emoji ? `${suggestion.emoji} ` : ""}
                    {suggestion.activityTitle}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
                    “{suggestion.text}”
                  </Text>
                  {!!(suggestion.frequencyPerWeek || suggestion.durationWeeks) && (
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                      {suggestion.frequencyPerWeek
                        ? `${suggestion.frequencyPerWeek} days/week`
                        : "Routine"}
                      {suggestion.durationWeeks
                        ? ` · ${suggestion.durationWeeks % 4 === 0 ? `${suggestion.durationWeeks / 4} months` : `${suggestion.durationWeeks} weeks`}`
                        : ""}
                    </Text>
                  )}
                  <Button secondary onPress={() => createPlan(suggestion)}>
                    Start a plan conversation
                  </Button>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ask coach instead"
                    onPress={() => askCoach(suggestion)}
                    style={({ pressed }) => ({
                      minHeight: 42,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Text style={{ color: c.muted, fontSize: 13 }}>
                      Ask coach instead
                    </Text>
                    <ChevronRight size={15} color={c.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View testID="voice-log-private-note" style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <LockKeyhole size={17} color={c.muted} strokeWidth={1.8} />
              <View style={{ gap: 2 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>
                  Private note
                </Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  Kept in your coach context
                </Text>
              </View>
            </View>
            <View
              style={{
                gap: 7,
                padding: 16,
                borderRadius: 18,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.inputBorder,
              }}
            >
              <Text style={{ color: c.text, fontWeight: "600" }}>
                {preview.note.title}
              </Text>
              {noteRepeatsTranscript ? (
                <Text style={{ color: c.muted, lineHeight: 20, fontSize: 13 }}>
                  The full note above will be kept privately for your coach.
                </Text>
              ) : (
                <Text style={{ color: c.text, lineHeight: 22 }}>
                  {preview.note.text}
                </Text>
              )}
              <Text style={{ color: c.muted, fontSize: 12 }}>
                Private to you and your coach
              </Text>
            </View>
          </View>

          {!!planMatch && (
            <View testID="voice-log-plan-context" style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Compass size={16} color={c.accent} />
                <Text style={{ color: c.text, fontSize: 13, fontWeight: "700" }}>
                  Coach context
                </Text>
              </View>
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                This sounds like useful direction for one of your structured plans.
              </Text>
              <View
                style={{
                  gap: 4,
                  borderRadius: 16,
                  backgroundColor: c.accent + "0d",
                  borderWidth: 1,
                  borderColor: c.accent + "38",
                  overflow: "hidden",
                }}
              >
                <ReviewRow
                  emoji={planMatch.planEmoji || "🧭"}
                  title={planMatch.planGoal}
                  detail={`Strong match for ${planMatch.activityTitle}. Save this cue with the plan.`}
                  label={`Save coach context to ${planMatch.planGoal}`}
                  selected={selectedPlanId === planMatch.planId}
                  onPress={() => setSelectedPlanId(planMatch.planId)}
                />
                <ReviewRow
                  icon={LockKeyhole}
                  title="Keep as a personal note"
                  detail="Keep it in your general coach context instead."
                  label="Keep coach context as a personal note"
                  selected={selectedPlanId === null}
                  onPress={() => setSelectedPlanId(null)}
                />
              </View>
              <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
                “{planMatch.contextText}”
              </Text>
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                Nothing changes in the plan until you save this note.
              </Text>
            </View>
          )}

          {!!personalCoachContextItems.length && (
            <View testID="voice-log-coach-context" style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Compass size={16} color={c.accent} />
                <Text style={{ color: c.text, fontSize: 13, fontWeight: "700" }}>
                  Coach context
                </Text>
              </View>
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                Useful direction for what your coach should keep in mind next.
              </Text>
              <View
                style={{
                  gap: 8,
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: c.accent + "0d",
                  borderWidth: 1,
                  borderColor: c.accent + "38",
                }}
              >
                {personalCoachContextItems.map((item) => (
                  <View key={`${item.text}-${item.reason}`} style={{ gap: 3 }}>
                    <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>
                      “{item.text}”
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                      Saved as personal coach context · not logged as a completed activity
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {!!notIncludedItems.length && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <AlertCircle size={16} color={c.muted} />
                <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
                  Not included
                </Text>
              </View>
              <Copy muted>
                We left these out because they were not clear enough to log.
              </Copy>
              <View style={{ gap: 8 }}>
                {notIncludedItems.map((item) => (
                  <View key={`${item.text}-${item.reason}`} style={{ gap: 2 }}>
                    <Text style={{ color: c.text, fontSize: 14 }}>“{item.text}”</Text>
                    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                      {item.reason}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Status error={error} />
          <View style={{ gap: 8 }}>
            <Button busy={isCommitting} onPress={() => void commit()}>
              Save voice note
            </Button>
            <Button secondary disabled={busy} onPress={makeChanges}>
              Make changes
            </Button>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start over"
              disabled={busy}
              onPress={() => void startOver()}
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                opacity: busy ? 0.4 : pressed ? 0.6 : 1,
              })}
            >
              <RotateCcw size={15} color={c.muted} />
              <Text style={{ color: c.muted, fontSize: 13 }}>Start over</Text>
            </Pressable>
          </View>
        </View>
      )}

      {phase === "committing" && (
        <View testID="voice-log-committing" style={{ alignItems: "center", gap: 14, paddingVertical: 24 }}>
          <ActivityIndicator color={c.accent} />
          <Text style={{ color: c.text, fontSize: 17, fontWeight: "600" }}>
            Saving your voice note…
          </Text>
        </View>
      )}

      {phase === "committed" && (
        <View testID="voice-log-committed" style={{ alignItems: "center", gap: 14, paddingVertical: 16 }}>
          <CheckCircle2 size={48} color="#10b981" strokeWidth={1.8} />
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
            Saved
          </Text>
          <Copy muted>
            Your voice note and selected logs are now in tracking.so.
          </Copy>
          <Button onPress={onClose}>Done</Button>
        </View>
      )}
      {aiConsent.sheet}
    </LoggingDrawer>
  );
}
