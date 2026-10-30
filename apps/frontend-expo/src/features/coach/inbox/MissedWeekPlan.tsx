import { useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Text } from "@/components/typography/Text";
import { Status, useColors } from "@/components/ui";
import { DrawerButton, DrawerHeader } from "@/components/drawer/Drawer";
import { api } from "@/data/api";
import {
  daysLeftThisWeek,
  missedWeek,
  rememberMissAnswered,
  spreadDays,
} from "@/features/timeline/home-cards/miss-reasons";
import type { MissedWeekPlanProps, WeekDayChipsProps } from "../types";

/** After the reason: tap this week's days, one button saves them. The coach reads the answer; nothing is sent in chat. */
export function MissedWeekPlan({ plan, reason, target, onBack, onSaved }: MissedWeekPlanProps) {
  const c = useColors();
  const client = useQueryClient();
  const open = daysLeftThisWeek();
  const [days, setDays] = useState(() => spreadDays(open, reason.suggest(target, open.length)));
  const save = useMutation({
    mutationFn: async () => {
      await api.post(`/follow-through/plans/${encodeURIComponent(plan.id)}/missed-week`, {
        week: missedWeek(),
        reason: reason.id,
        days,
      });
      await rememberMissAnswered(plan.id);
    },
    onSuccess: async () => {
      client.setQueryData(["miss-answered", plan.id], true);
      await client.invalidateQueries({ queryKey: ["follow-through"] });
      onSaved();
    },
  });
  return (
    <>
      <DrawerHeader emoji={reason.emoji} title="This week" subtitle={`${days.length} of ${target} · tap to change`} />
      <WeekDayChips days={open} value={days} onChange={setDays} />
      <Status error={save.error} />
      <DrawerButton
        testID="missed-week-save"
        label={days.length === 1 ? "Plan 1 day" : `Plan ${days.length} days`}
        disabled={!days.length}
        busy={save.isPending}
        onPress={() => save.mutate()}
      />
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        disabled={save.isPending}
        hitSlop={8}
        style={{ alignSelf: "center", paddingVertical: 4 }}
      >
        <Text style={{ color: c.muted, fontSize: 15, fontWeight: "500" }}>Back</Text>
      </Pressable>
    </>
  );
}

function WeekDayChips({ days, value, onChange }: WeekDayChipsProps) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
      {days.map((day, index) => {
        const selected = value.includes(day);
        const date = parseISO(day);
        return (
          <Pressable
            key={day}
            testID={`missed-week-day-${day}`}
            accessibilityRole="button"
            accessibilityLabel={index === 0 ? `Today, ${format(date, "EEEE")}` : format(date, "EEEE d MMMM")}
            accessibilityState={{ selected }}
            onPress={() =>
              onChange(selected ? value.filter((d) => d !== day) : [...value, day].sort())
            }
            style={{
              flex: 1,
              maxWidth: 64,
              minHeight: 64,
              borderRadius: 16,
              gap: 2,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: selected ? c.selectedBg : c.card,
              borderWidth: 1.5,
              borderColor: selected ? c.accent : "transparent",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: selected ? c.text : c.muted }}>
              {index === 0 ? "Today" : format(date, "EEE")}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: c.text }}>{format(date, "d")}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
