import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { TrendingUp, TrendingDown } from "lucide-react-native";
import { moodStats, months, yearMetrics } from "../model";
import { Stats, StoryPanel, StoryText, useStoryColors } from "../ui";
import type { StoryProps } from "../types";
export function Mood({ data }: StoryProps) {
  const entries = yearMetrics(data.metrics, data.year);
  const stats = moodStats(entries);
  const c = useStoryColors();
  if (entries.length < 7)
    return (
      <View
        style={{
          flex: 1,
          minHeight: 400,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <StoryText size={60}>😊</StoryText>
        <StoryText muted>Not enough mood data for {data.year}</StoryText>
      </View>
    );
  const colors = c.dark
    ? ["#242424", "#991B1B", "#9A3412", "#A16207", "#4D7C0F", "#166534"]
    : ["#EBEDF0", "#F87171", "#FDBA74", "#FDE047", "#A3E635", "#4ADE80"];
  return (
    <>
      <View style={{ gap: 8 }}>
        <StoryText title>Your Mood</StoryText>
        <StoryText muted>
          {entries.length} mood entries in {data.year}
        </StoryText>
      </View>
      <StoryText size={24}>
        {stats.average.toFixed(1)} <StoryText muted>avg mood</StoryText>
      </StoryText>
      <StoryPanel>
        <StoryText muted>Mood by Month</StoryText>
        <Svg
          width="100%"
          height={96}
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
        >
          {[1, 2, 3, 4].map((i) => (
            <Line
              key={i}
              x1={5}
              x2={95}
              y1={5 + i * 6}
              y2={5 + i * 6}
              stroke={c.border}
              strokeWidth={0.3}
            />
          ))}
          <Path
            d={
              "M " +
              stats.month
                .map(
                  (m, i) =>
                    `${5 + (i / 11) * 90},${m.count ? 35 - (m.average / 5) * 30 : 20}`,
                )
                .join(" L ")
            }
            stroke={c.text}
            strokeWidth={1.5}
            fill="none"
          />
          {stats.month
            .filter((m) => m.count)
            .map((m) => (
              <Circle
                key={m.index}
                cx={5 + (m.index / 11) * 90}
                cy={35 - (m.average / 5) * 30}
                r={m === stats.bestMonth || m === stats.worstMonth ? 2.5 : 1.5}
                fill={
                  m === stats.bestMonth
                    ? "#4ade80"
                    : m === stats.worstMonth
                      ? "#f87171"
                      : c.text
                }
              />
            ))}
        </Svg>
        <View style={{ flexDirection: "row" }}>
          {stats.month.map((m) => (
            <View key={m.label} style={{ flex: 1, alignItems: "center" }}>
              <StoryText muted size={9}>
                {m.label[0]}
              </StoryText>
              <StoryText muted size={8}>
                {m.count ? m.average.toFixed(1) : "–"}
              </StoryText>
            </View>
          ))}
        </View>
      </StoryPanel>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[
          {
            label: "Best Month",
            value: stats.bestMonth,
            Icon: TrendingUp,
            color: "#22c55e",
          },
          {
            label: "Hardest Month",
            value: stats.worstMonth,
            Icon: TrendingDown,
            color: "#ef4444",
          },
        ].map(
          ({ label, value, Icon, color }) =>
            value && (
              <StoryPanel
                key={label}
                style={{ flex: 1, backgroundColor: `${color}25` }}
              >
                <Icon size={16} color={color} />
                <StoryText size={12} style={{ color }}>
                  {label}
                </StoryText>
                <StoryText size={18} style={{ fontWeight: "700" }}>
                  {value.label}
                </StoryText>
                <StoryText style={{ color }}>
                  {value.average.toFixed(1)} avg
                </StoryText>
              </StoryPanel>
            ),
        )}
      </View>
      <StoryPanel>
        <StoryText muted>Day of Week Patterns</StoryText>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {stats.day.map((d) => (
            <View
              key={d.label}
              style={{ flex: 1, alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  height: 48,
                  width: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <View
                  style={{
                    height: d.count ? Math.max(7, (d.average / 5) * 48) : 2,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                    backgroundColor:
                      d === stats.bestDay
                        ? "#4ade80"
                        : d === stats.worstDay
                          ? "#f87171"
                          : c.dark
                            ? "#ffffff4d"
                            : "#a3a3a3",
                  }}
                />
              </View>
              <StoryText muted size={9}>
                {d.label}
              </StoryText>
              <StoryText muted size={8}>
                {d.count ? d.average.toFixed(1) : "–"}
              </StoryText>
            </View>
          ))}
        </View>
        {stats.bestDay && stats.bestDay.percentDiff > 5 && (
          <StoryText muted size={12}>
            Mood is {stats.bestDay.percentDiff.toFixed(0)}% higher on{" "}
            {stats.bestDay.label}s
          </StoryText>
        )}
        {stats.worstDay && stats.worstDay.percentDiff < -5 && (
          <StoryText muted size={12}>
            Mood is {Math.abs(stats.worstDay.percentDiff).toFixed(0)}% lower on{" "}
            {stats.worstDay.label}s
          </StoryText>
        )}
      </StoryPanel>
      <StoryPanel>
        <StoryText muted>Quick Stats</StoryText>
        <Stats
          items={[
            { value: stats.max, label: "Best day" },
            { value: stats.average.toFixed(1), label: "Average" },
            { value: stats.min, label: "Toughest day" },
          ]}
        />
      </StoryPanel>
      <StoryPanel>
        <StoryText muted>Your mood calendar</StoryText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {months.map((month, m) => {
            const first = new Date(data.year, m, 1).getDay();
            const days = new Date(data.year, m + 1, 0).getDate();
            return (
              <View
                key={month}
                style={{ width: "30%", alignItems: "center", gap: 4 }}
              >
                <StoryText muted size={11}>
                  {month.toUpperCase()}
                </StoryText>
                <Svg width="100%" height={88} viewBox="0 0 72 84">
                  {Array.from({ length: days }, (_, i) => {
                    const logs = entries.filter((e) => {
                      const d = new Date(e.createdAt);
                      return d.getMonth() === m && d.getDate() === i + 1;
                    });
                    const rating = logs.length
                      ? logs.reduce((s, e) => s + e.rating, 0) / logs.length
                      : 0;
                    return (
                      <Rect
                        key={i}
                        x={Math.floor((i + first) / 7) * 12}
                        y={((i + first) % 7) * 12}
                        width={10}
                        height={10}
                        rx={2}
                        fill={
                          colors[Math.min(5, Math.max(0, Math.round(rating)))]
                        }
                      />
                    );
                  })}
                </Svg>
              </View>
            );
          })}
        </View>
      </StoryPanel>
    </>
  );
}
