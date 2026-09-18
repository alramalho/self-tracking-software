import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Flame, Rocket, Sprout } from "lucide-react-native";
import { rankedPlans, peakStreak, tier, yearEntries, photoUrl } from "../model";
import { Podium, StoryPanel, StoryText, useStoryColors } from "../ui";
import { PhotoPreview } from "../PhotoPreview";
import type { ActivityEntry } from "@/core/types";
import type { StoryProps } from "../types";
export function Plans({ data }: StoryProps) {
  const ranked = rankedPlans(data.plans, data.annualPlans);
  const c = useStoryColors();
  const [selected, setSelected] = useState<string>();
  const [photo, setPhoto] = useState<ActivityEntry>();
  const [failed, setFailed] = useState<string[]>([]);
  const ids = new Set(
    (selected ? ranked.filter((p) => p.id === selected) : ranked).flatMap((p) =>
      p.activities.map((a) => a.id),
    ),
  );
  const photos = yearEntries(data.entries, data.year)
    .filter(
      (e) =>
        e.activityId &&
        ids.has(e.activityId) &&
        photoUrl(e) &&
        !failed.includes(e.id),
    )
    .sort((a, b) => (b.reactions?.length ?? 0) - (a.reactions?.length ?? 0))
    .slice(0, 8);
  const select = (id: string) =>
    setSelected((old) => (old === id ? undefined : id));
  return (
    <>
      <StoryText title>{data.year}'s plans</StoryText>
      <Podium
        items={ranked.map((p) => ({
          id: p.id,
          emoji: p.emoji,
          name: p.goal,
          color: tier(p, data.annualPlans) === "lifestyle" ? "#8b5cf6" : "#10b981",
        }))}
        onPress={select}
      />
      <View style={{ gap: 8 }}>
        {ranked.map((p, i) => {
          const peak = peakStreak(p, data.annualPlans);
          const lifestyle = Math.max(0, peak - 8);
          const habit = Math.max(0, Math.min(peak, 8) - 3);
          const TierIcon = lifestyle ? Rocket : Sprout;
          const label = tier(p, data.annualPlans) === "lifestyle"
            ? `Lifestyle earned in ${data.year}`
            : tier(p, data.annualPlans) === "habit"
              ? `Habit earned in ${data.year}`
              : lifestyle ? `Lifestyle streak in ${data.year}` : habit ? `Habit streak in ${data.year}` : "";
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Filter memories for ${p.goal}`}
              accessibilityState={{ selected: selected === p.id }}
              key={p.id}
              onPress={() => select(p.id)}
            >
              <StoryPanel
                style={{
                  paddingVertical: 10,
                  backgroundColor: selected === p.id ? "#8b5cf622" : c.soft,
                  borderWidth: 1,
                  borderColor: selected === p.id ? "#8b5cf666" : "transparent",
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <StoryText muted>{i + 1}</StoryText>
                <StoryText size={24}>{p.emoji}</StoryText>
                <View style={{ flex: 1, gap: 4 }}>
                  <StoryText>{p.goal}</StoryText>
                  {!!label && (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 4,
                        alignItems: "center",
                      }}
                    >
                      <TierIcon
                        size={11}
                        color={lifestyle ? "#f59e0b" : "#84cc16"}
                      />
                      <StoryText
                        size={11}
                        style={{
                          color: lifestyle ? "#f59e0b" : "#84cc16",
                          flexShrink: 1,
                        }}
                      >
                        {label}
                      </StoryText>
                    </View>
                  )}
                </View>
                <View style={{ gap: 3, alignItems: "flex-end" }}>
                  {peak > 0 && (
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 4,
                        alignItems: "center",
                      }}
                    >
                      <Flame size={12} color="#fb923c" />
                      <StoryText style={{ color: "#fb923c" }}>{peak}</StoryText>
                      <StoryText muted size={10}>
                        peak
                      </StoryText>
                    </View>
                  )}
                </View>
              </StoryPanel>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {photos.map((e) => (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={`Open memory ${e.id}`}
            onPress={() => setPhoto(e)}
            style={{ width: "23%", aspectRatio: 1 }}
          >
            <Image
              source={{ uri: photoUrl(e) }}
              onError={() => setFailed((v) => [...v, e.id])}
              style={{ width: "100%", height: "100%", borderRadius: 12 }}
            />
          </Pressable>
        ))}
      </View>
      <PhotoPreview
        entry={photo}
        activity={data.activities.find((a) => a.id === photo?.activityId)}
        onClose={() => setPhoto(undefined)}
      />
    </>
  );
}
