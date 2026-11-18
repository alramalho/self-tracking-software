import { View } from "react-native";
import { addDays, format, startOfWeek } from "date-fns";
import type { HomeDay } from "@tsw/prisma/home-todo";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { CoachNote } from "@/features/messages/adaptation/CoachNote";
import { TwoWeeks } from "@/features/timeline/home-todo/Days";
import type { AdaptingWeeksProps } from "./types";

/** Six planned this week (Mon–Sat), four done: the slip that leads to the 6 → 5 suggestion. */
const PLANNED_DAYS = [1, 2, 3, 4, 5, 6];
const DONE_DAYS = [1, 2, 4, 5];
const NEXT_DAYS = [1, 2, 4, 5, 6];

const keyOf = (date: Date) => format(date, "yyyy-MM-dd");

/** A made-up week on the homepage's own tiles: emoji days, done ones ticked green. */
function demoWeek(from: Date, days: number[], done: number[], emoji: string): HomeDay[] {
  return Array.from({ length: 7 }, (_, offset) => {
    const kind = done.includes(offset) ? "done" : "scheduled";
    return {
      key: keyOf(addDays(from, offset)),
      isToday: false,
      isPast: false,
      items: days.includes(offset)
        ? [{ id: `${kind}-${offset}`, planId: "demo", planGoal: "", activityId: "demo", title: "", emoji, kind }]
        : [],
    };
  });
}

function WeekLabel({ children }: { children: string }) {
  const c = useColors();
  return <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>{children}</Text>;
}

/** A week that slipped, the coach's note, and a lighter next week: the plan follows what happened. */
export function AdaptingWeeks({ strategist, emoji }: AdaptingWeeksProps) {
  const thisWeek = startOfWeek(new Date());
  const nextWeek = addDays(thisWeek, 7);
  const c = useColors();
  const noop = () => {};
  return (
    <View
      testID="adapting-weeks"
      accessible
      accessibilityLabel="Example: four of six sessions done this week, so your coach eases next week to five."
      style={{ gap: 12 }}
    >
      <WeekLabel>This week · 4 of 6 done</WeekLabel>
      <TwoWeeks weeks={[demoWeek(thisWeek, PLANNED_DAYS, DONE_DAYS, emoji)]} selectedKey="" onSelect={noop} testPrefix="demo-day" />
      <CoachNote strategist={strategist} mood="sad" size="small">
        <Text style={{ color: c.text, fontSize: 14, lineHeight: 19 }}>Six was a lot this week. Next week, five.</Text>
      </CoachNote>
      <WeekLabel>Next week · 5</WeekLabel>
      <TwoWeeks weeks={[demoWeek(nextWeek, NEXT_DAYS, [], emoji)]} selectedKey="" onSelect={noop} testPrefix="demo-day" />
    </View>
  );
}
