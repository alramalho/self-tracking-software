import { StoryReveal } from "../Motion";
import { Image, View } from "react-native";
import { Flame } from "lucide-react-native";
import { Podium, StoryPanel, StoryText, useStoryColors } from "../ui";
import { accountLevels } from "@/features/profile/model";
import type { LeaderboardProps } from "../types";
export function Leaderboard({ data, streaks }: LeaderboardProps) {
  const c = useStoryColors();
  const self = data.self;
  const ranked = [self, ...data.friends]
    .filter((p) => !streaks || p.bestStreak > 0)
    .sort((a, b) =>
      streaks ? b.bestStreak - a.bestStreak : b.totalPoints - a.totalPoints,
    );
  const color = (points: number) => {
    const level =
      accountLevels.findLast((l) => points >= l.threshold) ?? accountLevels[0];
    return c.dark ? level.dark : level.light;
  };
  const name = (person: typeof self) =>
    person.username === self.username ? "You" : person.name || person.username;
  return (
    <>
      <StoryReveal testID="wrapped-ranking-header">
        {!streaks && (
          <StoryText title style={{ fontSize: 20, opacity: 0.5 }}>
            tracking.software
          </StoryText>
        )}
        <StoryText title>
          {streaks ? `${data.year}'s streaks` : `${data.year}'s leaderboard`}
        </StoryText>
        <StoryText muted size={12} style={{ marginTop: 8 }}>
          {streaks
            ? `Best streaks during ${data.year}`
            : "Activities + badges earned this year"}
        </StoryText>
      </StoryReveal>
      <StoryReveal delay={200} duration={500} testID="wrapped-ranking-podium">
        <Podium
          items={ranked.map((p) => ({
            id: p.username,
            picture: p.picture,
            name: name(p).split(" ")[0],
            color: color(p.totalPoints),
          }))}
        />
      </StoryReveal>
      <View style={{ gap: 8 }}>
        {ranked.map((p, i) => (
          <StoryReveal
            key={p.username}
            delay={700 + i * 50}
            duration={300}
            rise={10}
            testID={`wrapped-ranking-row-${p.username}`}
          >
            <StoryPanel
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 10,
                borderWidth: p.username === self.username ? 1 : 0,
                borderColor: c.border,
              }}
            >
              <StoryText
                style={{ color: color(p.totalPoints), fontWeight: "700" }}
              >
                {i + 1}
              </StoryText>
              {p.picture ? (
                <Image
                  source={{ uri: p.picture }}
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                />
              ) : (
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: `${color(p.totalPoints)}30`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <StoryText>{name(p)[0]}</StoryText>
                </View>
              )}
              <StoryText style={{ flex: 1 }}>{name(p)}</StoryText>
              {streaks && <Flame size={14} color="#fb923c" />}
              <StoryText
                style={{
                  color: streaks ? "#fb923c" : color(p.totalPoints),
                  fontWeight: "600",
                }}
              >
                {(streaks ? p.bestStreak : p.totalPoints).toLocaleString()}
              </StoryText>
              <StoryText muted size={11}>
                {streaks ? "wks" : "pts"}
              </StoryText>
            </StoryPanel>
          </StoryReveal>
        ))}
      </View>
    </>
  );
}
