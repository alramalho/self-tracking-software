import { sessionDay, sessionLogDate } from "./dates";
import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { CalendarClock, Check, CircleDashed, Pause, Play, Sparkles, Square, Timer, Undo2 } from "lucide-react-native";
import { addDays, format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ActivityEntry } from "@/core/types";
import type { PracticeSession } from "@tsw/prisma/follow-through";
import {
  Button,
  Copy,
  Field,
  Heading,
  IconButton,
  Panel,
  Status,
  useColors,
} from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { goBack } from "@/core/navigation";
import { useAction, useCurrentUser, useEntries, usePlans, usePlan } from "@/data/queries";
import { api } from "@/data/api";
import { Logger } from "@/features/activities/Logger";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { CoachNote } from "@/features/messages/adaptation/CoachNote";
import { SettingsGroup } from "@/features/settings/SettingsGroup";
import { SettingsRow } from "@/features/settings/SettingsRow";
import { sessionPath, useFollowThrough } from "./api";
import {
  defaultSupport,
  isFlexiblePlan,
  planLogPath,
  localDay,
  timerSeconds,
  clockLabel,
} from "./model";
import { SessionTargetRows } from "@/features/plans/SessionTargetRows";
export default function SessionScreen() {
  const {
    id,
    planId,
    date: initialDate,
  } = useLocalSearchParams<{ id: string; planId?: string; date?: string }>();
  const query = useFollowThrough(),
    plans = usePlans(),
    entries = useEntries(),
    client = useQueryClient(),
    user = useCurrentUser(),
    c = useColors();
  const session = query.data?.state.sessions[id];
  const currentPlan = usePlan(session?.planId || planId);
  const plan =
    currentPlan.data ??
    plans.data?.find((p) => p.id === (session?.planId || planId));
  const support =
    plan && (query.data?.state.supports[plan.id] ?? defaultSupport(plan));
  const activity = plan?.activities.find((a) => a.id === session?.activityId);
  const [date, setDate] = useState(initialDate || localDay());
  const [time, setTime] = useState("");
  const [editing, setEditing] = useState(false);
  const [more, setMore] = useState(false);
  const [logging, setLogging] = useState(false);
  const [partial, setPartial] = useState(false);
  const [log, setLog] = useState<ActivityEntry>();
  const [error, setError] = useState<unknown>();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!session?.timerRunning) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [session?.timerRunning]);
  const seconds = session ? timerSeconds(session, now) : 0;
  const action = useAction(async (operation: string) =>
    api.post(`${sessionPath(id)}/timer`, { action: operation }),
  );
  const complete = useAction(async (entry: ActivityEntry) =>
    api.post(`${sessionPath(id)}/outcome`, {
      outcome: partial ? "PARTLY" : "DONE",
      entryId: entry.id,
    }),
  );
  const skip = useAction(async () =>
    api.post(`${sessionPath(id)}/outcome`, { outcome: "SKIPPED" }),
  );
  const move = useAction(async () => {
    await api.patch(sessionPath(id), { date, time: time.trim() || null });
    setEditing(false);
  });
  const create = useMutation({
    mutationFn: async () => {
      if (!plan || !support) throw new Error("Plan is still loading");
      if (!query.data?.state.supports[plan.id])
        await api.put(`/follow-through/plans/${plan.id}`, support);
      return (
        await api.post<PracticeSession>("/follow-through/sessions", {
          planId: plan.id,
          date,
          time: time.trim() || null,
        })
      ).data;
    },
    onSuccess: async (created) => {
      await client.invalidateQueries({ queryKey: ["follow-through"] });
      router.replace(`/session/${encodeURIComponent(created.id)}` as never);
    },
  });
  const matching = session
    ? (entries.data?.filter(
        (e) =>
          e.activityId === session.activityId &&
          !e.deletedAt &&
          sessionDay(new Date(e.datetime), session.timezone) === session.date &&
          !Object.values(query.data?.state.sessions ?? {}).some(
            (s) => s.id !== id && s.entryId === e.id,
          ),
      ) ?? [])
    : [];
  if (plan && query.data && isFlexiblePlan(plan, support))
    return <Redirect href={planLogPath(plan) as never} />;
  // Logging replaces the sheet (iOS shows one modal at a time); once it closes after a save, so does this.
  if (logging && activity && session)
    return (
      <Logger
        activity={activity}
        initialDate={sessionLogDate(session.date, session.timezone)}
        initialQuantity={
          /minutes?/i.test(activity.measure)
            ? Math.floor(seconds / 60)
            : undefined
        }
        onLogged={(entry) => {
          setLog(entry);
          complete.mutate(entry);
        }}
        onClose={() => (log ? goBack() : setLogging(false))}
      />
    );
  const existing = plan?.sessions.find((s) => `existing:${s.id}` === id);
  // The coach's words for today: this session's guide, else the plan's next step.
  const guide = existing?.descriptiveGuide || support?.nextStep;
  const notYet =
    !activity || !session || session.date > sessionDay(new Date(), session.timezone);
  return (
    <LoggingDrawer
      testID="session-sheet"
      dismissLabel="Close session"
      title={plan ? `${plan.emoji} ${plan.goal}` : "Session"}
      onClose={goBack}
    >
      <Status
        loading={query.isLoading || plans.isLoading || currentPlan.isLoading}
        error={query.error ?? currentPlan.error ?? plans.error}
        retry={() => void query.refetch()}
      />
      {!query.isLoading && !query.error && id !== "new" && !session && (
        <Copy>
          This session is no longer available. Return to your week to choose
          another.
        </Copy>
      )}
      {id === "new" && plan && (
        <>
          <Copy muted>
            A slot is a plan for this session. Your weekly target stays the
            same.
          </Copy>
          <Field
            label="Day"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
          />
          <Field
            label="Time, optional"
            value={time}
            onChangeText={setTime}
            placeholder="18:00"
          />
          <Button
            busy={create.isPending}
            disabled={!query.data}
            onPress={() => create.mutate()}
          >
            {date === localDay() && !time
              ? "Start today’s session"
              : "Save session"}
          </Button>
        </>
      )}
      {session && support && (
        <>
          <Text style={{ color: c.muted, fontSize: 14, textAlign: "center", marginTop: -12 }}>
            {sessionWhen(session)}
          </Text>
          {!!guide && (
            <CoachNote strategist={user.data?.coachPersonality === "STRATEGIST"} mood="smiling">
              <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>{guide}</Text>
            </CoachNote>
          )}
          {session.source === "EXISTING" && !!existing?.targets && (
            <Panel>
              <SessionTargetRows targets={existing.targets} />
            </Panel>
          )}
          {session.outcome === "UNCONFIRMED" ? (
            <>
              {support.format === "RESOURCE" && support.resourceUrl && (
                <Button
                  secondary
                  onPress={() => {
                    if (/^https:\/\//i.test(support.resourceUrl!))
                      void Linking.openURL(support.resourceUrl!).catch(setError);
                  }}
                >{`Open ${support.resourceName || "resource"}`}</Button>
              )}
              {(support.format === "TIMER" ||
                session.elapsedSeconds > 0 ||
                session.timerRunning) && (
                <Panel>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontSize: 24, fontFamily: "Inter-Bold" }}>{clockLabel(seconds)}</Text>
                      <Text style={{ color: c.muted, fontSize: 13 }}>{`${session.durationMinutes} min planned`}</Text>
                    </View>
                    {seconds > 0 && !session.timerRunning && (
                      <IconButton label="Finish timer" icon={Square} onPress={() => action.mutate("FINISH")} />
                    )}
                    <IconButton
                      label={session.timerRunning ? "Pause timer" : seconds ? "Resume timer" : "Start timer"}
                      icon={session.timerRunning ? Pause : Play}
                      onPress={() => action.mutate(session.timerRunning ? "PAUSE" : "START")}
                    />
                  </View>
                </Panel>
              )}
              {log && complete.isError ? (
                <>
                  <Copy>Your activity is saved. Retry linking it to this session.</Copy>
                  <Button busy={complete.isPending} onPress={() => complete.mutate(log)}>
                    Link saved activity
                  </Button>
                </>
              ) : (
                <Button
                  disabled={notYet}
                  onPress={() => {
                    setPartial(false);
                    setLogging(true);
                  }}
                >
                  Log activity
                </Button>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More session options"
                accessibilityState={{ expanded: more }}
                onPress={() => setMore(!more)}
                style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}
              >
                <Copy muted>{more ? "Fewer options" : "More options"}</Copy>
              </Pressable>
              {more && matching.length > 0 && (
                <SettingsGroup title="Already logged?">
                  {matching.map((entry) => (
                    <SettingsRow
                      key={entry.id}
                      icon={Check}
                      title={`Use ${entry.quantity} ${activity?.measure || ""} at ${format(new Date(entry.datetime), "HH:mm")}`}
                      disabled={complete.isPending}
                      onPress={() => {
                        setPartial(false);
                        complete.mutate(entry);
                      }}
                    />
                  ))}
                </SettingsGroup>
              )}
              {more && (
                <SettingsGroup>
                  <SettingsRow
                    icon={CircleDashed}
                    title="Partly done"
                    disabled={notYet}
                    chevron
                    onPress={() => {
                      setPartial(true);
                      setLogging(true);
                    }}
                  />
                  <SettingsRow
                    icon={CalendarClock}
                    title="Move this session"
                    disabled={session.timerRunning}
                    chevron
                    onPress={() => {
                      setDate(session.date);
                      setTime(session.time || "");
                      setEditing(!editing);
                    }}
                  />
                  <SettingsRow
                    icon={Undo2}
                    title="Not this time"
                    disabled={skip.isPending}
                    onPress={() => skip.mutate()}
                  />
                </SettingsGroup>
              )}
              {more && editing && (
                <Panel>
                  <Field label="Day" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
                  <Field label="Time, optional" value={time} onChangeText={setTime} placeholder="18:00" />
                  <Button busy={move.isPending} onPress={() => move.mutate()}>
                    Save new slot
                  </Button>
                  <Button secondary onPress={() => setEditing(false)}>
                    Cancel
                  </Button>
                </Panel>
              )}
            </>
          ) : (
            <>
              <Panel>
                <Heading>
                  {session.outcome === "SKIPPED"
                    ? "Not this time"
                    : session.outcome === "PARTLY"
                      ? "Partly done"
                      : "Logged"}
                </Heading>
                <Copy>
                  {session.outcome === "SKIPPED"
                    ? "Your next session is still there. No catching-up debt."
                    : "Your activity is saved in your timeline and plan."}
                </Copy>
              </Panel>
              <Button secondary onPress={goBack}>
                Done
              </Button>
            </>
          )}
          {more && (
            <SettingsGroup>
              <SettingsRow
                icon={Sparkles}
                title="Plan assistance"
                chevron
                onPress={() => router.push(`/plan-support/${session.planId}` as never)}
              />
              <SettingsRow
                icon={Timer}
                title="Session tools"
                chevron
                onPress={() => router.push(`/plan-support/${session.planId}?tools=1` as never)}
              />
            </SettingsGroup>
          )}
        </>
      )}
      <Status
        error={
          action.error ??
          complete.error ??
          skip.error ??
          move.error ??
          create.error ??
          error
        }
      />
    </LoggingDrawer>
  );
}

/** "Today · Any time", with the session's time zone only when it isn't this phone's. */
function sessionWhen(session: PracticeSession) {
  const today = sessionDay(new Date(), session.timezone);
  const day = new Date(`${session.date}T12:00:00`);
  const label =
    session.date === today
      ? "Today"
      : session.date === format(addDays(new Date(`${today}T12:00:00`), -1), "yyyy-MM-dd")
        ? "Yesterday"
        : session.date === format(addDays(new Date(`${today}T12:00:00`), 1), "yyyy-MM-dd")
          ? "Tomorrow"
          : format(day, "EEEE, MMM d");
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return [label, session.time || "Any time", session.timezone !== here ? session.timezone : null]
    .filter(Boolean)
    .join(" · ");
}
