import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { format } from "date-fns";
import { ChevronRight, CircleHelp, Moon } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import {
  Button,
  Copy,
  Panel,
  Sheet,
  Status,
  useColors,
} from "@/components/ui";
import { asDate } from "@/core/dates";
import { useSleepScores } from "../queries";
import {
  SLEEP_RANGE_DAYS,
  SLEEP_RANGES,
  type SleepRange,
  type SleepScore,
} from "../sleep-types";
import { SleepBreakdown } from "./Breakdown";
import { NightStrip } from "./NightStrip";
import { SleepGrid } from "./SleepGrid";
import type { SleepHeroProps, SleepRangePickerProps } from "./types";

const BASELINE_NIGHTS = 7;

// A night without a total says in a few words when the score will appear,
// instead of a paragraph. The help sheet carries the full explanation.
const pendingScoreLabel = (score: SleepScore) => {
  if (score.status === "incomplete") return "Partial data";
  const remaining = Math.max(1, BASELINE_NIGHTS - (score.baselineNights ?? 0));
  return `Score in ${remaining} ${remaining === 1 ? "night" : "nights"}`;
};

const awakeningsLabel = (count: number) =>
  `${count} ${count === 1 ? "awakening" : "awakenings"}`;

// The selected night is the one big number on the card: the score when we
// have one, otherwise time asleep, so the card never leads with a dash.
function SleepHero({ score }: SleepHeroProps) {
  const c = useColors();
  const asleep = Math.round(score.asleepMinutes);
  const hours = Math.floor(asleep / 60);
  const minutes = asleep % 60;
  const big = { fontSize: 44, fontWeight: "700", color: c.text } as const;
  const unit = { fontSize: 17, fontWeight: "600", color: c.muted } as const;
  const detail =
    score.total != null
      ? `${hours}h ${minutes}m asleep · ${awakeningsLabel(score.awakenings)}`
      : `${awakeningsLabel(score.awakenings)} · ${pendingScoreLabel(score)}`;
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: c.muted }}>
        {format(asDate(score.date), "EEEE, MMM d")}
      </Text>
      {score.total != null ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text style={big}>{score.total}</Text>
          <Text style={unit}>out of 100</Text>
        </View>
      ) : (
        <Text accessibilityLabel={`${hours} hours ${minutes} minutes asleep`}>
          <Text style={big}>{hours}</Text>
          <Text style={unit}>h </Text>
          <Text style={big}>{minutes}</Text>
          <Text style={unit}>m</Text>
        </Text>
      )}
      <Text style={{ fontSize: 15, color: c.muted }}>{detail}</Text>
    </View>
  );
}

// iOS-style segmented control: the selected segment is lifted, the rest sit
// flat on the track.
function SleepRangePicker({ range, onChange }: SleepRangePickerProps) {
  const c = useColors();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        padding: 2,
        borderRadius: 9,
        backgroundColor: c.soft,
      }}
    >
      {SLEEP_RANGES.map((value) => {
        const active = value === range;
        return (
          <Pressable
            key={value}
            testID={`sleep-range-${value}`}
            accessibilityRole="button"
            accessibilityLabel={`Show sleep for ${value}`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(value)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              paddingVertical: 6,
              borderRadius: 7,
              backgroundColor: active
                ? c.dark
                  ? "#48484a"
                  : "#ffffff"
                : "transparent",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: c.text,
                fontSize: 13,
                fontWeight: active ? "600" : "500",
              }}
            >
              {value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SleepMetric() {
  const [range, setRange] = useState<SleepRange>("7D");
  const result = useSleepScores(range);
  const c = useColors();
  const [selectedDate, setSelectedDate] = useState<string>();
  const [help, setHelp] = useState(false);
  const scores = result.data?.scores ?? [];
  const selected =
    scores.find((score) => score.date === selectedDate) ?? scores[0];
  return (
    <Panel
      testID="sleep-metric"
      style={{ padding: 20, borderRadius: 20, gap: 20 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Moon size={20} color={c.accent} strokeWidth={2} />
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 17, fontWeight: "600", color: c.text }}
        >
          Sleep score
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="About sleep score"
          hitSlop={12}
          onPress={() => setHelp(true)}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CircleHelp size={20} color={c.muted} strokeWidth={1.8} />
        </Pressable>
      </View>
      {!selected ? (
        <>
          <Copy muted>
            Connect Apple Health or Garmin Connect to see your nights.
          </Copy>
          <Button onPress={() => router.push("/health")}>
            Manage health data
          </Button>
        </>
      ) : (
        <>
          <SleepHero score={selected} />
          <View style={{ gap: 16 }}>
            <SleepRangePicker range={range} onChange={setRange} />
            {range === "7D" ? (
              <NightStrip
                scores={scores}
                selectedDate={selected.date}
                onSelect={setSelectedDate}
              />
            ) : (
              <SleepGrid
                scores={scores}
                days={SLEEP_RANGE_DAYS[range]}
                selectedDate={selected.date}
                onSelect={setSelectedDate}
              />
            )}
          </View>
          <SleepBreakdown score={selected} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage health data"
            onPress={() => router.push("/health")}
            style={({ pressed }) => ({
              marginBottom: -6,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: c.soft,
              flexDirection: "row",
              alignItems: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ flex: 1, fontSize: 15, color: c.text }}>
              Manage health data
            </Text>
            <ChevronRight size={18} color={c.muted} strokeWidth={1.8} />
          </Pressable>
        </>
      )}
      <Sheet
        visible={help}
        title="How your sleep score works"
        onClose={() => setHelp(false)}
      >
        <Copy>
          We score each night from your connected device's sleep: duration up
          to 50 points against an 8-hour reference, bedtime consistency up to
          30, and interruptions up to 20.
        </Copy>
        <Copy>
          Consistency compares your bedtime with the seven nights before, so
          the total appears once those are recorded. Nights with missing data
          keep their measurements and show no total. Missing nights never count
          as zero.
        </Copy>
        <Copy muted>
          This is our own estimate, not Apple's score or a medical assessment.
          Your latest sleep may take time to arrive from your Watch.
        </Copy>
      </Sheet>
      <Status error={result.error} retry={() => void result.refetch()} />
    </Panel>
  );
}
