import { useState } from "react";
import { Pressable, View } from "react-native";
import { Clock, Dumbbell, Footprints, Gauge, Target } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { addDay, dayNumber, liftText, longDate, paceText, sessionsOn, unitLabel, weekRange, weekday } from "./format";
import type { SessionDetailProps, TwoWeeksProps } from "./types";

function Row({ icon: Icon, children }: { icon: typeof Clock; children: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <Icon size={18} color={c.muted} strokeWidth={1.8} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, color: c.text, fontSize: 15, lineHeight: 21 }}>{children}</Text>
    </View>
  );
}

// What a session asks for, in numbers: time, effort and pace (or sets, reps, load), and how you'll know it worked.
export function SessionDetail({ session, activity }: SessionDetailProps) {
  const c = useColors();
  const t = session.targets;
  const pace = paceText(t);
  const lift = liftText(t);
  return (
    <View testID="session-detail" style={{ gap: 12, padding: 18, borderRadius: 18, backgroundColor: c.card }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>
          {activity.emoji} {session.title}
        </Text>
        <Text style={{ color: c.muted, fontSize: 14 }}>
          {longDate(session.date)} · {session.quantity} {unitLabel(activity.measure, session.quantity)}
        </Text>
      </View>
      <Row icon={Clock}>{`${t.durationMinutes} min`}</Row>
      <Row icon={Gauge}>{t.effort}</Row>
      {pace && <Row icon={Footprints}>{pace}</Row>}
      {lift && <Row icon={Dumbbell}>{`${t.exercise ? `${t.exercise} · ` : ""}${lift}`}</Row>}
      <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>{session.descriptiveGuide}</Text>
      <Row icon={Target}>{t.progressMeasure}</Row>
    </View>
  );
}

// The old preview, kept: two calendar weeks, tap a day to open it. Rest days open too.
export function TwoWeeks({ sessions, activity, startDate }: TwoWeeksProps) {
  const c = useColors();
  const first = sessions[0]?.date ?? startDate;
  const [day, setDay] = useState(first);
  const selected = sessionsOn(sessions, day);
  return (
    <View testID="two-weeks" style={{ gap: 14 }}>
      {[0, 1].map((week) => {
        const from = addDay(startDate, week * 7);
        return (
          <View key={week} style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600" }}>
              Week {week + 1} · {weekRange(from)}
            </Text>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDay(from, i);
                const here = sessionsOn(sessions, d);
                const active = d === day;
                return (
                  <Pressable
                    key={d}
                    testID={`day-${d}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${longDate(d)}${here.length ? `, ${here.map((s) => s.title).join(", ")}` : ", rest day"}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => setDay(d)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 76,
                      alignItems: "center",
                      gap: 4,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? c.accent : c.inputBorder,
                      backgroundColor: c.card,
                    }}
                  >
                    <Text style={{ color: c.muted, fontSize: 10, fontWeight: "600" }}>{weekday(d).toUpperCase()}</Text>
                    <Text style={{ color: c.text, fontSize: 15, fontWeight: "700" }}>{dayNumber(d)}</Text>
                    {here.map((s, n) => (
                      <Text key={n} style={{ color: c.text, fontSize: 12 }}>
                        {activity.emoji}
                        {s.quantity}
                      </Text>
                    ))}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
      {selected.length ? (
        selected.map((s, i) => <SessionDetail key={i} session={s} activity={activity} />)
      ) : (
        <View testID="rest-day" style={{ padding: 18, borderRadius: 18, backgroundColor: c.card, gap: 2 }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: "700" }}>Rest day</Text>
          <Text style={{ color: c.muted, fontSize: 14 }}>{longDate(day)}</Text>
        </View>
      )}
    </View>
  );
}
