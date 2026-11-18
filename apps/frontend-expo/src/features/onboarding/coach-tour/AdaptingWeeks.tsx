import { View } from "react-native";
import { addDays, format, startOfWeek } from "date-fns";
import type { HomeDay } from "@tsw/prisma/home-todo";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { CoachNote } from "@/features/messages/adaptation/CoachNote";
import { TwoWeeks } from "@/features/timeline/home-todo/Days";
import type { AdaptingWeeksProps } from "./types";

const DONE_DAYS = [1, 3, 5];
const NEXT_DAYS = [1, 3, 5, 6];
/** The day the coach adds after a full week. */
const ADDED_DAY = 6;

const keyOf = (date: Date) => format(date, "yyyy-MM-dd");

/** A made-up week on the homepage's own tiles: emoji days, done ones ticked green. */
function demoWeek(from: Date, days: number[], kind: "done" | "scheduled", emoji: string): HomeDay[] {
  return Array.from({ length: 7 }, (_, offset) => ({
    key: keyOf(addDays(from, offset)),
    isToday: false,
    isPast: false,
    items: days.includes(offset)
      ? [{ id: `${kind}-${offset}`, planId: "demo", planGoal: "", activityId: "demo", title: "", emoji, kind }]
      : [],
  }));
}

function WeekLabel({ children }: { children: string }) {
  const c = useColors();
  return <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>{children}</Text>;
}

/** This week done, the coach's note, and next week one session bigger: the plan follows what happened. */
export function AdaptingWeeks({ strategist, emoji }: AdaptingWeeksProps) {
  const thisWeek = startOfWeek(new Date());
  const nextWeek = addDays(thisWeek, 7);
  const c = useColors();
  const noop = () => {};
  return (
    <View
      testID="adapting-weeks"
      accessible
      accessibilityLabel="Example: all three sessions done this week, so your coach adds a fourth next week."
      style={{ gap: 12 }}
    >
      <WeekLabel>This week · 3 of 3 done</WeekLabel>
      <TwoWeeks weeks={[demoWeek(thisWeek, DONE_DAYS, "done", emoji)]} selectedKey="" onSelect={noop} testPrefix="demo-day" />
      <CoachNote strategist={strategist} mood="smiling" size="small">
        <Text style={{ color: c.text, fontSize: 14, lineHeight: 19 }}>All three done. Next week gets a fourth.</Text>
      </CoachNote>
      <WeekLabel>Next week · one more</WeekLabel>
      <TwoWeeks
        weeks={[demoWeek(nextWeek, NEXT_DAYS, "scheduled", emoji)]}
        selectedKey={keyOf(addDays(nextWeek, ADDED_DAY))}
        onSelect={noop}
        testPrefix="demo-day"
      />
    </View>
  );
}
