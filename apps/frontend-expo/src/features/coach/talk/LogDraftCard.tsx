import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import { Panel, useColors } from "@/components/ui";
import type { VoiceLogPreview } from "@/features/voice-log/types";
import { dayLabel } from "./service";

const MAX_ROWS = 4;

const when = (day: string) => {
  const today = new Date();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today.getTime() - 86_400_000);
  return day === key(today) ? "Today" : day === key(yesterday) ? "Yesterday" : dayLabel(day);
};

/** What the coach understood from their words, about to be logged: one row per session, like a log card. */
export function LogDraftCard({ draft }: { draft: VoiceLogPreview }) {
  const c = useColors();
  const rows = [...draft.activities].sort((a, b) => a.date.localeCompare(b.date));
  const shown = rows.length > MAX_ROWS ? rows.slice(-MAX_ROWS) : rows;
  return (
    <Panel testID="talk-log-draft" style={{ alignSelf: "stretch", paddingVertical: 6, paddingHorizontal: 16 }}>
      {shown.map((a, i) => (
        <View
          key={`${a.activityId}-${a.date}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}
        >
          <Text style={{ fontSize: 30 }}>{a.emoji}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }} numberOfLines={1}>
              {a.title}
            </Text>
            <Text style={{ color: c.muted, fontSize: 15 }}>
              {a.quantity} {a.measure} · {when(a.date)}
            </Text>
          </View>
        </View>
      ))}
      {rows.length > shown.length && (
        <Text style={{ color: c.muted, fontSize: 14, paddingBottom: 10 }}>+{rows.length - shown.length} earlier days</Text>
      )}
    </Panel>
  );
}
