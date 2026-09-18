import { View } from "react-native";
import { activityTotals, yearEntries } from "../model";
import { Podium, Stats, StoryPanel, StoryText } from "../ui";
import type { StoryProps } from "../types";
export function Activities({ data }: StoryProps) {
  const entries = yearEntries(data.entries, data.year);
  const totals = activityTotals(entries, data.activities);
  return (
    <>
      <StoryText title>{data.year}'s activities</StoryText>
      <Stats
        items={[
          {
            value: new Set(
              entries
                .filter((e) => e.activityId)
                .map((e) => new Date(e.datetime).toISOString().slice(0, 10)),
            ).size,
            label: "active days",
          },
          { value: totals.length, label: "different activities" },
        ]}
      />
      <Podium
        items={totals.map((t) => ({
          id: t.activity.id,
          emoji: t.activity.emoji,
          name: t.activity.title,
        }))}
      />
      {totals.map((t, i) => (
        <StoryPanel
          key={t.activity.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            gap: 12,
          }}
        >
          <StoryText muted>{i + 1}</StoryText>
          <StoryText size={22}>{t.activity.emoji}</StoryText>
          <StoryText style={{ flex: 1 }}>{t.activity.title}</StoryText>
          <View style={{ alignItems: "flex-end" }}>
            <StoryText>
              {t.quantity.toLocaleString()}{" "}
              <StoryText muted size={11}>
                {t.activity.measure}
              </StoryText>
            </StoryText>
            <StoryText muted size={11}>
              {t.days} {t.days === 1 ? "day" : "days"}
            </StoryText>
          </View>
        </StoryPanel>
      ))}
    </>
  );
}
