import { sessionDay, sessionLogDate } from "./dates";
import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ActivityEntry } from "@/core/types";
import type { PracticeSession } from "@tsw/prisma/follow-through";
import {
  Screen,
  Button,
  Copy,
  Field,
  Heading,
  IconButton,
  Panel,
  Status,
} from "@/components/ui";
import { goBack } from "@/core/navigation";
import { useAction, useEntries, usePlans, usePlan } from "@/data/queries";
import { api } from "@/data/api";
import { Logger } from "@/features/activities/Logger";
import { sessionPath, useFollowThrough } from "./api";
import {
  defaultSupport,
  isFlexiblePlan,
  planLogPath,
  localDay,
  timerSeconds,
  clockLabel,
} from "./model";
export default function SessionScreen() {
  const {
    id,
    planId,
    date: initialDate,
  } = useLocalSearchParams<{ id: string; planId?: string; date?: string }>();
  const query = useFollowThrough(),
    plans = usePlans(),
    entries = useEntries(),
    client = useQueryClient();
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
  return (
    <Screen
      title={plan ? `${plan.emoji} ${plan.goal}` : "Session"}
      leading={<IconButton label="Back" icon={ArrowLeft} onPress={goBack} />}
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
          <Heading>Choose a slot</Heading>
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
          <Copy
            muted
          >{`${format(new Date(`${session.date}T12:00:00`), "EEEE, MMM d")} · ${session.time || "Any time"} · ${session.timezone}`}</Copy>
          {!!support.nextStep && (
            <Panel>
              <Copy>{support.nextStep}</Copy>
            </Panel>
          )}
          {session.source === "EXISTING" &&
            !!plan?.sessions.find((s) => `existing:${s.id}` === id)
              ?.descriptiveGuide && (
              <Panel>
                <Copy>
                  {
                    plan.sessions.find((s) => `existing:${s.id}` === id)!
                      .descriptiveGuide!
                  }
                </Copy>
              </Panel>
            )}
          {session.outcome === "UNCONFIRMED" ? (
            <>
              {support.format === "RESOURCE" && support.resourceUrl && (
                <>
                  <Button
                    onPress={() => {
                      if (/^https:\/\//i.test(support.resourceUrl!))
                        void Linking.openURL(support.resourceUrl!).catch(
                          setError,
                        );
                    }}
                  >{`Open ${support.resourceName || "resource"}`}</Button>
                  <Copy muted>
                    Continue in your course, then return to log what you did.
                  </Copy>
                </>
              )}
              {(support.format === "TIMER" ||
                session.elapsedSeconds > 0 ||
                session.timerRunning) && (
                <Panel>
                  <Heading>{clockLabel(seconds)}</Heading>
                  <Copy
                    muted
                  >{`${session.durationMinutes} minutes planned`}</Copy>
                  <Button
                    busy={action.isPending}
                    onPress={() =>
                      action.mutate(session.timerRunning ? "PAUSE" : "START")
                    }
                  >
                    {session.timerRunning
                      ? "Pause timer"
                      : seconds
                        ? "Resume timer"
                        : "Start timer"}
                  </Button>
                  {seconds > 0 && (
                    <Button
                      secondary
                      busy={action.isPending}
                      onPress={() => action.mutate("FINISH")}
                    >
                      Finish timer
                    </Button>
                  )}
                  <Copy muted>
                    The timer measures time. Log the activity when you are done.
                  </Copy>
                </Panel>
              )}
              <Button
                disabled={
                  !activity ||
                  session.date > sessionDay(new Date(), session.timezone)
                }
                onPress={() => {
                  setPartial(false);
                  setLogging(true);
                }}
              >
                Log activity
              </Button>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More session options"
                accessibilityState={{ expanded: more }}
                onPress={() => setMore(!more)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Copy muted>{more ? "Fewer options" : "More options"}</Copy>
              </Pressable>
              {more && (
                <Button
                  secondary
                  disabled={
                    !activity ||
                    session.date > sessionDay(new Date(), session.timezone)
                  }
                  onPress={() => {
                    setPartial(true);
                    setLogging(true);
                  }}
                >
                  Partly done
                </Button>
              )}
              {more && matching.length > 0 && (
                <>
                  <Copy muted>Already logged?</Copy>
                  {matching.map((entry) => (
                    <Button
                      key={entry.id}
                      secondary
                      busy={complete.isPending}
                      onPress={() => {
                        setPartial(false);
                        complete.mutate(entry);
                      }}
                    >{`Use ${entry.quantity} ${activity?.measure || ""} at ${format(new Date(entry.datetime), "HH:mm")}`}</Button>
                  ))}
                </>
              )}
              {log && complete.isError && (
                <>
                  <Copy>
                    Your activity is saved. Retry linking it to this session.
                  </Copy>
                  <Button
                    busy={complete.isPending}
                    onPress={() => complete.mutate(log)}
                  >
                    Link saved activity
                  </Button>
                </>
              )}
              {more && (
                <>
                  <Button
                    secondary
                    busy={skip.isPending}
                    onPress={() => skip.mutate()}
                  >
                    Not this time
                  </Button>
                  <Button
                    secondary
                    disabled={session.timerRunning}
                    onPress={() => {
                      setDate(session.date);
                      setTime(session.time || "");
                      setEditing(!editing);
                    }}
                  >
                    Move this session
                  </Button>
                  {editing && (
                    <Panel>
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
                        busy={move.isPending}
                        onPress={() => move.mutate()}
                      >
                        Save new slot
                      </Button>
                      <Button secondary onPress={() => setEditing(false)}>
                        Cancel
                      </Button>
                    </Panel>
                  )}
                </>
              )}
            </>
          ) : (
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
          )}
          {more && (
            <>
              <Button
                secondary
                onPress={() =>
                  router.push(`/plan-support/${session.planId}` as never)
                }
              >
                Plan assistance
              </Button>
              <Button
                secondary
                onPress={() =>
                  router.push(
                    `/plan-support/${session.planId}?tools=1` as never,
                  )
                }
              >
                Session tools
              </Button>
            </>
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
      {session && session.outcome !== "UNCONFIRMED" && (
        <Button
          secondary
          onPress={() => router.replace("/(tabs)/plans?view=week" as never)}
        >
          Back to this week
        </Button>
      )}
      {logging && activity && session && (
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
          onClose={() => setLogging(false)}
        />
      )}
    </Screen>
  );
}
