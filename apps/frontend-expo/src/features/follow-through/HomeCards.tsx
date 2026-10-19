import { useState } from "react";
import { Pressable, View } from "react-native";
import { CalendarDays, ArrowUpRight } from "lucide-react-native";
import { router, useIsFocused } from "expo-router";
import { Button, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { Reveal } from "@/components/reveal/Reveal";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { useFollowThrough } from "./api";
import { activePlans, localDay, visibleSessions } from "./model";
import { SessionRow } from "./SessionRow";
import type { FollowThroughHomeProps } from "./types";
// Up next on the home grid. The coach's checks moved to the Coach tab.
export function FollowThroughHome({ plans }: FollowThroughHomeProps) {
  const focused = useIsFocused();
  const query = useFollowThrough(),
    c = useColors();
  const [open, setOpen] = useState(false);
  const state = query.data?.state;
  const sessions = visibleSessions({ state, plans })
    .filter((s) => s.outcome === "UNCONFIRMED" && s.date >= localDay())
    .slice(0, 3);
  const next = sessions[0],
    plan = plans.find((p) => p.id === next?.planId);
  if (!activePlans(plans).length || !next) return null;
  return (
    <>
      <Reveal id="home-up-next" style={{ width: "48%" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Up next"
          onPress={() => setOpen(true)}
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
            <Text style={{ color: c.text, fontWeight: "600", fontSize: 18 }}>Up next</Text>
            <Text numberOfLines={2} style={{ color: c.text, fontSize: 14 }}>
              {plan ? `${plan.emoji} ${plan.goal}` : "Your flexible week"}
            </Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {`${next.date === localDay() ? "Today" : new Date(`${next.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })} · ${next.time || "Any time"}`}
            </Text>
          </View>
          <ArrowUpRight size={18} color={c.muted} />
        </Pressable>
      </Reveal>
      {open && focused && (
        <LoggingDrawer title="Up next" dismissLabel="Dismiss overview" testID="follow-through-overview" onClose={() => setOpen(false)}>
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} plan={plans.find((p) => p.id === session.planId)!} />
          ))}
          <Button
            onPress={() => {
              setOpen(false);
              router.push({ pathname: "/(tabs)/plans", params: plan ? { selectedPlan: plan.id } : {} });
            }}
          >
            See this week
          </Button>
        </LoggingDrawer>
      )}
    </>
  );
}
