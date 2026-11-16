import { Image, View } from "react-native";
import { reviewWeekLine } from "@tsw/prisma/follow-through/coach-inbox";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import type { Plan } from "@/core/types";
import type { ReviewWeek } from "@tsw/prisma/follow-through/coach-inbox";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** "8–14 Nov", the week a review looks back on. */
export function reviewRange(week: Pick<ReviewWeek, "days">) {
  const from = new Date(`${week.days[0].key}T12:00:00`);
  const to = new Date(`${week.days[6].key}T12:00:00`);
  const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });
  return month(from) === month(to)
    ? `${from.getDate()}–${to.getDate()} ${month(to)}`
    : `${from.getDate()} ${month(from)} – ${to.getDate()} ${month(to)}`;
}

/** One plan's reviewed week: the plan, the count, and the seven days with the logged ones filled. */
export function ReviewWeekCard({ week }: { week: ReviewWeek<Plan> }) {
  const c = useColors();
  const met = week.target > 0 && week.done >= week.target;
  return (
    <View
      testID="review-week"
      accessibilityLabel={`${week.plan.goal}: ${reviewWeekLine(week)}`}
      style={{ backgroundColor: c.card, borderRadius: 16, padding: 16, gap: 14 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontSize: 22, lineHeight: 28 }}>{week.plan.emoji || week.plan.activities[0]?.emoji || "🎯"}</Text>
        <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: "600" }}>
          {week.plan.goal}
        </Text>
        <Text style={{ color: met ? c.accent : c.muted, fontSize: 15, fontWeight: "700" }}>
          {week.target ? `${week.done} of ${week.target}` : week.done}
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {week.days.map((day, i) => (
          <View key={day.key} style={{ alignItems: "center", gap: 6 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: "600" }}>{DAY_LETTERS[i]}</Text>
            <View
              testID={day.logged ? "review-day-logged" : "review-day"}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: day.logged ? c.accent : "transparent",
                borderWidth: day.logged ? 0 : 1.5,
                borderColor: c.inputBorder,
              }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/** What the coach said, as a quiet bubble next to its face. */
export function CoachLine({ text, avatar }: { text: string; avatar: number }) {
  const c = useColors();
  return (
    <View testID="review-coach-line" style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
      <Image source={avatar} style={{ width: 36, height: 36 }} />
      <View style={{ flex: 1, backgroundColor: c.soft, borderRadius: 18, borderBottomLeftRadius: 6, paddingVertical: 12, paddingHorizontal: 14 }}>
        <Text style={{ color: c.text, fontSize: 16, lineHeight: 22 }}>{text}</Text>
      </View>
    </View>
  );
}
