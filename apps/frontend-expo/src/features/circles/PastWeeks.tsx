import { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import { ChevronRight } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Copy, Panel, Sheet, useColors } from "@/components/ui";
import { firstName } from "./components";
import { pastWeeksLine, personColors, weekBars } from "./model";
import type { PastWeeksChartProps, PastWeeksRowProps, PastWeeksSheetProps } from "./types";

const CHART_HEIGHT = 170;
const TOP = 26;
const BOTTOM = 22;

// The circle page row: a tiny bar per finished week, the streak together and where you stand.
export function PastWeeksRow({ board, viewerId, onPress }: PastWeeksRowProps) {
  const c = useColors();
  const past = board.pastWeeks;
  if (!past) return null;
  const mine = past.ranking.find((r) => r.userId === viewerId);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Past weeks" onPress={onPress}>
      {({ pressed }) => (
        <Panel style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.6 : 1 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 30 }}>
            {weekBars(past, board.members)
              .filter((bar) => !bar.current)
              .map((bar) => {
                const done = bar.segments.reduce((sum, s) => sum + s.done, 0);
                const share = bar.target ? Math.min(1, done / bar.target) : 0;
                return (
                  <View
                    key={bar.key}
                    style={{
                      width: 7,
                      height: Math.max(3, 30 * share),
                      borderRadius: 2,
                      backgroundColor: bar.allHit ? c.accent : c.muted,
                      opacity: bar.allHit ? 1 : 0.45,
                    }}
                  />
                );
              })}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>Past weeks</Text>
            <Copy muted>{pastWeeksLine(board.togetherStreak, mine?.percent)}</Copy>
          </View>
          <ChevronRight size={20} color={c.muted} />
        </Panel>
      )}
    </Pressable>
  );
}

// Stacked bars: the circle's sessions each week, one colour per person, against the
// dashed line of everyone's targets added up. The week in progress is faded and outlined.
function Chart({ bars, colors, highlight }: PastWeeksChartProps) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const lastFinished = bars.filter((bar) => !bar.current).at(-1);
  const target = lastFinished?.target ?? 0;
  const tallest = Math.max(target, ...bars.map((bar) => bar.segments.reduce((sum, s) => sum + s.done, 0)), 1);
  const unit = (CHART_HEIGHT - TOP - BOTTOM) / tallest;
  const base = CHART_HEIGHT - BOTTOM;
  const gap = 12;
  const barWidth = Math.min(34, (width - gap * (bars.length + 1)) / bars.length);
  const left = (width - (barWidth * bars.length + gap * (bars.length - 1))) / 2;
  const targetY = base - target * unit;
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: CHART_HEIGHT }}>
      {width > 0 && (
        <Svg width={width} height={CHART_HEIGHT}>
          {target > 0 && (
            <>
              <Line x1={0} x2={width} y1={targetY} y2={targetY} stroke={c.muted} strokeWidth={1} strokeDasharray="4 4" />
              <SvgText x={width} y={targetY - 5} fontSize={10} fontFamily="Inter-Regular" fill={c.muted} textAnchor="end">
                {`circle target ${target}`}
              </SvgText>
            </>
          )}
          {bars.map((bar, i) => {
            const x = left + i * (barWidth + gap);
            let y = base;
            return (
              <G key={bar.key}>
                {bar.segments.map((segment) => {
                  const height = segment.done * unit;
                  y -= height;
                  const dimmed = highlight && highlight !== segment.userId;
                  return height > 0 ? (
                    <Rect
                      key={segment.userId}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(1, height - 1.5)}
                      rx={3}
                      fill={colors[segment.userId] ?? c.muted}
                      opacity={dimmed ? 0.25 : bar.current ? 0.4 : 1}
                    />
                  ) : null;
                })}
                {bar.current && target > 0 && (
                  <Rect
                    x={x - 0.5}
                    y={targetY}
                    width={barWidth + 1}
                    height={base - targetY}
                    rx={4}
                    fill="none"
                    stroke={c.muted}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                )}
                <SvgText
                  x={x + barWidth / 2}
                  y={base + 15}
                  fontSize={11}
                  fontFamily={bar.current ? "Inter-Bold" : "Inter-Regular"}
                  fill={bar.current ? c.text : c.muted}
                  textAnchor="middle"
                >
                  {bar.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      )}
      {/* 🔥 over every week where everyone hit theirs (plain text: emoji don't belong in SVG). */}
      {width > 0 &&
        bars.map((bar, i) => {
          const done = bar.segments.reduce((sum, s) => sum + s.done, 0);
          return bar.allHit ? (
            <Text
              key={bar.key}
              style={{
                position: "absolute",
                left: left + i * (barWidth + gap),
                width: barWidth,
                top: base - done * unit - 20,
                textAlign: "center",
                fontSize: 13,
              }}
            >
              🔥
            </Text>
          ) : null;
        })}
    </View>
  );
}

// Together first (the bars against the circle's target), then the friendly race:
// everyone ranked by the share of their own target, so paces compare fairly.
export function PastWeeksSheet({ board, viewerId, visible, onClose }: PastWeeksSheetProps) {
  const c = useColors();
  const [highlight, setHighlight] = useState<string>();
  const past = board.pastWeeks;
  if (!past) return null;
  const colors = personColors(board.members);
  const count = past.weeks.length;
  return (
    <Sheet visible={visible} title="Past weeks" onClose={onClose}>
      <Copy muted>{`last ${count} ${count === 1 ? "week" : "weeks"}`}</Copy>
      <Chart bars={weekBars(past, board.members)} colors={colors} highlight={highlight} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>Most consistent</Text>
        <Copy muted>% of own target</Copy>
      </View>
      {past.ranking.map((row) => {
        const member = board.members.find((m) => m.user.id === row.userId);
        if (!member) return null;
        const color = colors[row.userId];
        const name = row.userId === viewerId ? "You" : firstName(member.user);
        return (
          <Pressable
            key={row.userId}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${row.percent}% of own target`}
            aria-pressed={highlight === row.userId}
            onPress={() => setHighlight(highlight === row.userId ? undefined : row.userId)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 8,
              opacity: highlight && highlight !== row.userId ? 0.45 : 1,
            }}
          >
            <Text style={{ width: 14, color: c.muted, fontSize: 14, fontVariant: ["tabular-nums"] }}>{row.rank}</Text>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
            <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 15 }}>
              {name}
            </Text>
            <View style={{ flexDirection: "row", gap: 3 }}>
              {row.hits.map((hit, i) => (
                <View
                  key={past.weeks[i].start}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 3,
                    backgroundColor: hit ? color : hit === false ? c.soft : "transparent",
                  }}
                />
              ))}
            </View>
            <Text style={{ width: 46, textAlign: "right", color: c.text, fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
              {`${row.percent}%`}
            </Text>
          </Pressable>
        );
      })}
      <Copy muted>A square fills when you hit your week.</Copy>
    </Sheet>
  );
}
