import { useState } from "react";
import { Pressable, View } from "react-native";
import { CalendarDays, Sparkles, ArrowUpRight } from "lucide-react-native";
import { router, useIsFocused } from "expo-router";
import { Button, Copy, Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { Reveal } from "@/components/reveal/Reveal";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { useAction } from "@/data/queries";
import { api } from "@/data/api";
import { useFollowThrough } from "./api";
import {
  activePlans,
  isFlexiblePlan,
  localDay,
  visibleSessions,
} from "./model";
import { SessionRow } from "./SessionRow";
import type { FollowThroughHomeProps } from "./types";
export function FollowThroughHome({ plans }: FollowThroughHomeProps) {
  const focused = useIsFocused();
  const query = useFollowThrough(),
    c = useColors();
  const [open, setOpen] = useState<"coach" | "next" | null>(null);
  const state = query.data?.state;
  const checks = Object.values(state?.checks ?? {})
    .filter(
      (check) =>
        (check.kind !== "SESSION" ||
          plans.some(
            (p) =>
              p.id === check.planId &&
              !isFlexiblePlan(p, state?.supports[p.id]),
          )) &&
        !check.answeredAt &&
        !check.dismissedAt &&
        Date.parse(check.dueAt) <= Date.now(),
    )
    .sort((a, b) => b.dueAt.localeCompare(a.dueAt));
  const check = checks[0];
  const sessions = visibleSessions({ state, plans })
    .filter((s) => s.outcome === "UNCONFIRMED" && s.date >= localDay())
    .slice(0, 3);
  const next = sessions[0],
    plan = plans.find((p) => p.id === next?.planId);
  const coached = Object.values(state?.supports ?? {}).some(
    (s) => s.preferences.coaching,
  );
  const respond = useAction(async (action: "ANSWER" | "DISMISS") => {
    if (check)
      await api.post(`/follow-through/checks/${encodeURIComponent(check.id)}`, {
        action,
      });
    setOpen(null);
  });
  const resume = useAction(async (enabled: boolean) => {
    await api.post("/follow-through/reach-outs", { enabled });
    setOpen(null);
  });
  if (!activePlans(plans).length) return null;
  return (
    <>
      {coached && (check || state?.pausedAt) && (
        <Reveal id="home-coach-check" style={{ width: "48%" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Coach quick check"
            onPress={() => setOpen("coach")}
            style={{
              aspectRatio: 1,
              borderRadius: 24,
              backgroundColor: c.card,
              padding: 16,
              justifyContent: "space-between",
            }}
          >
            <Sparkles size={28} color={c.bright} />
            <View style={{ gap: 6 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
                {state?.pausedAt
                  ? "A little space"
                  : check
                    ? "One quick check"
                    : "All set"}
              </Text>
              <Text numberOfLines={3} style={{ color: c.muted, fontSize: 13 }}>
                {state?.pausedAt
                  ? "Coach reach-outs are paused"
                  : check?.message || "Your next step is outside the app."}
              </Text>
            </View>
            <ArrowUpRight size={18} color={c.muted} />
          </Pressable>
        </Reveal>
      )}
      {next && (
        <Reveal id="home-up-next" style={{ width: "48%" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Up next"
            onPress={() => setOpen("next")}
            style={{
              aspectRatio: 1,
              borderRadius: 24,
              backgroundColor: c.card,
              padding: 16,
              justifyContent: "space-between",
            }}
          >
            <CalendarDays size={28} color={c.bright} />
            <View style={{ gap: 6 }}>
              <Text style={{ color: c.text, fontWeight: "600", fontSize: 18 }}>
                Up next
              </Text>
              <Text numberOfLines={2} style={{ color: c.text, fontSize: 14 }}>
                {plan ? `${plan.emoji} ${plan.goal}` : "Your flexible week"}
              </Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>
                {next
                  ? `${next.date === localDay() ? "Today" : new Date(`${next.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })} · ${next.time || "Any time"}`
                  : "Choose your next session"}
              </Text>
            </View>
            <ArrowUpRight size={18} color={c.muted} />
          </Pressable>
        </Reveal>
      )}
      {open && focused && (
        <LoggingDrawer
          title={open === "coach" ? "One quick check" : "Up next"}
          dismissLabel="Dismiss overview"
          testID="follow-through-overview"
          onClose={() => setOpen(null)}
        >
          {open === "next" ? (
            <>
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  plan={plans.find((p) => p.id === session.planId)!}
                />
              ))}
              {!sessions.length && (
                <Copy muted>
                  Your week is flexible. Pick a session when you have time.
                </Copy>
              )}
              <Button
                onPress={() => {
                  setOpen(null);
                  router.push("/(tabs)/plans?view=week" as never);
                }}
              >
                See this week
              </Button>
            </>
          ) : state?.pausedAt ? (
            <>
              <Copy>
                Your coach has stepped back. Session reminders you chose are
                still on.
              </Copy>
              <Button
                busy={resume.isPending}
                onPress={() => resume.mutate(true)}
              >
                Resume agreed coach checks
              </Button>
              <Button secondary onPress={() => setOpen(null)}>
                Keep it quiet
              </Button>
            </>
          ) : check ? (
            <>
              <Copy>{check.message}</Copy>
              {check.sessionId ? (
                <Button
                  onPress={() => {
                    setOpen(null);
                    router.push(
                      `/session/${encodeURIComponent(check.sessionId!)}` as never,
                    );
                  }}
                >
                  Done, partly, or not this time
                </Button>
              ) : (
                <>
                  <Button
                    onPress={() => {
                      setOpen(null);
                      router.push("/(tabs)/plans?view=week" as never);
                    }}
                  >
                    View my progress
                  </Button>
                  <Button
                    secondary
                    busy={respond.isPending}
                    onPress={() => respond.mutate("ANSWER")}
                  >
                    Keep my plan
                  </Button>
                  <Button
                    secondary
                    onPress={() => {
                      setOpen(null);
                      router.push(`/plan-support/${check.planId}` as never);
                    }}
                  >
                    Adjust my next step or reminders
                  </Button>
                </>
              )}
              <Button
                secondary
                busy={respond.isPending}
                onPress={() => respond.mutate("DISMISS")}
              >
                Not now
              </Button>
            </>
          ) : (
            <>
              <Copy>No check-in needed. Your plan is ready when you are.</Copy>
              <Button
                secondary
                onPress={() => {
                  setOpen(null);
                  router.push("/(tabs)/plans?view=week" as never);
                }}
              >
                See my week
              </Button>
            </>
          )}
          <Status error={respond.error ?? resume.error} />
        </LoggingDrawer>
      )}
    </>
  );
}
