import { useState } from "react";
import { Pressable, View } from "react-native";
import { addDays, addWeeks, format, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { router } from "expo-router";
import {
  Button,
  Copy,
  Heading,
  IconButton,
  Panel,
  Status,
  useColors,
} from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { Reveal } from "@/components/reveal/Reveal";
import { CalendarConnection } from "./CalendarConnection";
import { useFollowThrough } from "./api";
import {
  activePlans,
  completedDays,
  isFlexiblePlan,
  localDay,
  planLogPath,
  visibleSessions,
} from "./model";
import { SessionRow } from "./SessionRow";
import type { WeekOverviewProps } from "./types";

export function WeekOverview({ plans, entries }: WeekOverviewProps) {
  const query = useFollowThrough(),
    c = useColors();
  const [selected, setSelected] = useState(localDay());
  const date = new Date(`${selected}T12:00:00`),
    start = startOfWeek(date);
  const active = activePlans(plans);
  const sessions = visibleSessions({ state: query.data?.state, plans });
  const today = sessions.filter((s) => s.date === selected);
  const flexible = active.filter((p) =>
    isFlexiblePlan(p, query.data?.state.supports[p.id]),
  );
  const scheduled = active.some(
    (p) => !isFlexiblePlan(p, query.data?.state.supports[p.id]),
  );
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {scheduled && (
          <IconButton
            label="Previous week"
            icon={ChevronLeft}
            onPress={() => setSelected(localDay(addWeeks(date, -1)))}
          />
        )}
        <View style={{ flex: 1 }}>
          <Heading>
            {scheduled
              ? `${format(start, "MMM d")} – ${format(addDays(start, 6), "d")}`
              : "This week"}
          </Heading>
        </View>
        {scheduled && (
          <IconButton
            label="Next week"
            icon={ChevronRight}
            onPress={() => setSelected(localDay(addWeeks(date, 1)))}
          />
        )}
        <CalendarConnection asMenu />
      </View>
      {scheduled && (
        <>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const day = addDays(start, i),
                key = localDay(day),
                chosen = key === selected;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={format(day, "EEEE MMMM d")}
                  accessibilityState={{ selected: chosen }}
                  onPress={() => setSelected(key)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    gap: 7,
                    alignItems: "center",
                    borderRadius: 20,
                    backgroundColor: chosen ? c.selectedBg : "transparent",
                  }}
                >
                  <Text
                    style={{ color: chosen ? c.bright : c.muted, fontSize: 10 }}
                  >
                    {format(day, "EEE").toUpperCase()}
                  </Text>
                  <Text
                    style={{
                      color: chosen ? c.bright : c.text,
                      fontSize: 17,
                      fontWeight: "600",
                    }}
                  >
                    {format(day, "d")}
                  </Text>
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: sessions.some((s) => s.date === key)
                        ? c.accent
                        : "transparent",
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
          <Heading>
            {selected === localDay() ? "Today" : format(date, "EEEE")}
          </Heading>
          {!!today.length && (
            <Panel
              style={{ padding: 0, gap: 0, borderWidth: 0, overflow: "hidden" }}
            >
              {today.map((session, i) => (
                <Reveal key={session.id} delay={i * 40}>
                  <View
                    style={{ borderTopWidth: i ? 1 : 0, borderColor: c.border }}
                  >
                    <SessionRow
                      grouped
                      session={session}
                      plan={plans.find((p) => p.id === session.planId)!}
                    />
                  </View>
                </Reveal>
              ))}
            </Panel>
          )}
          {!today.length && <Copy muted>No sessions scheduled.</Copy>}
        </>
      )}
      {!!flexible.length && (
        <>
          {scheduled && <Heading>Any time this week</Heading>}
          <Panel
            style={{ padding: 0, gap: 0, borderWidth: 0, overflow: "hidden" }}
          >
            {flexible.map((plan, i) => {
              const count = completedDays(
                plan,
                entries,
                scheduled ? date : new Date(),
              );
              const target = Math.max(1, plan.timesPerWeek || 1);
              return (
                <Reveal key={plan.id} delay={i * 40}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Log activity for ${plan.goal}`}
                    onPress={() => router.push(planLogPath(plan) as never)}
                    style={({ pressed }) => ({
                      padding: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      opacity: pressed ? 0.65 : 1,
                      borderTopWidth: i ? 1 : 0,
                      borderColor: c.border,
                    })}
                  >
                    <Text style={{ fontSize: 30 }}>{plan.emoji}</Text>
                    <View style={{ flex: 1, gap: 7 }}>
                      <Text
                        style={{
                          color: c.text,
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        {plan.goal}
                      </Text>
                      <Text
                        style={{ color: c.muted, fontSize: 13 }}
                      >{`${count} of ${target} this week · Log activity`}</Text>
                      <View
                        accessibilityRole="progressbar"
                        accessibilityLabel={`${plan.goal} weekly progress`}
                        accessibilityValue={{
                          min: 0,
                          max: Math.max(count, target),
                          now: count,
                        }}
                        style={{ flexDirection: "row", gap: 4, marginTop: 3 }}
                      >
                        {Array.from(
                          { length: Math.min(target, 7) },
                          (_, index) => (
                            <View
                              key={index}
                              style={{
                                flex: 1,
                                height: 5,
                                borderRadius: 3,
                                backgroundColor:
                                  index < count ? "#22c55e" : c.soft,
                              }}
                            />
                          ),
                        )}
                      </View>
                    </View>
                    <ChevronRight size={18} color={c.muted} />
                  </Pressable>
                </Reveal>
              );
            })}
          </Panel>
        </>
      )}
      <Status
        loading={query.isLoading}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {!active.length && (
        <Button onPress={() => router.push("/create-plan")}>
          Create a plan
        </Button>
      )}
    </>
  );
}
