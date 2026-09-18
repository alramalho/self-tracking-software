import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, CircleHelp, Moon } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import {
  Button,
  Copy,
  Heading,
  IconButton,
  Panel,
  Sheet,
  Status,
  s,
  useColors,
} from "@/components/ui";
import { dateLabel } from "@/core/dates";
import { useSleepScores } from "../queries";
import {
  SLEEP_RANGE_DAYS,
  SLEEP_RANGES,
  type SleepRange,
} from "../sleep-types";
import { SleepBreakdown } from "./Breakdown";
import { NightStrip } from "./NightStrip";
import { SleepGrid } from "./SleepGrid";
import type { SleepNavigationRowProps } from "./types";

// A navigation row keeps the card to one obvious next step instead of a stack
// of equal-weight buttons. Mirrors HealthHomeCard.
function NavigationRow({
  label,
  detail,
  leading,
  onPress,
}: SleepNavigationRowProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>
          {label}
        </Text>
        {!!detail && (
          <Text style={{ fontSize: 13, color: c.muted }}>{detail}</Text>
        )}
      </View>
      <ChevronRight size={18} color={c.muted} strokeWidth={1.8} />
    </Pressable>
  );
}

// A night with no total still shows its recorded measurements and explains
// why the score is withheld, instead of rendering a bare dash.
const statusNote = (selected: {
  status: "ready" | "learning" | "incomplete";
  baselineNights: number;
}) =>
  selected.status === "learning"
    ? selected.baselineNights == null
      ? "Keep syncing so we can compare your bedtime pattern."
      : selected.baselineNights +
        " of 7 previous nights available. Your score appears once we can compare your bedtime pattern."
    : selected.status === "incomplete"
      ? "Some sleep or awake periods are missing. We keep the recorded measurements without guessing a total."
      : null;

export function SleepMetric() {
  const [range, setRange] = useState<SleepRange>("7D");
  const result = useSleepScores(range);
  const c = useColors();
  const [selectedDate, setSelectedDate] = useState<string>();
  const [help, setHelp] = useState(false);
  const scores = result.data?.scores ?? [];
  const selected =
    scores.find((score) => score.date === selectedDate) ?? scores[0];
  const note = selected ? statusNote(selected) : null;
  const asleepMinutes = Math.round(selected?.asleepMinutes ?? 0);
  return (
    <Panel
      testID="sleep-metric"
      style={{ padding: 20, borderRadius: 16, gap: 16 }}
    >
      <View style={s.row}>
        <View
          accessibilityLabel="Sleep"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.soft,
          }}
        >
          <Moon size={20} color={c.muted} strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Heading>Sleep score</Heading>
          <Copy muted>From your recorded connected-device sleep</Copy>
        </View>
        <IconButton
          label="About sleep score"
          icon={CircleHelp}
          onPress={() => setHelp(true)}
        />
      </View>
      {!selected ? (
        <>
          <Copy>
            Connect Apple Health or Garmin Connect to see a daily sleep estimate
            and your recent nights.
          </Copy>
          <Button onPress={() => router.push("/health")}>
            Manage health data
          </Button>
        </>
      ) : (
        <>
          {selected.total != null ? (
            <View
              style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}
            >
              <Text style={{ fontSize: 48, fontWeight: "700", color: c.text }}>
                {selected.total}
              </Text>
              <Copy muted>out of 100</Copy>
            </View>
          ) : (
            <View style={{ gap: 4, paddingVertical: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>
                {selected.status === "learning"
                  ? "Learning your pattern"
                  : "Partial sleep data"}
              </Text>
              {!!note && <Copy muted>{note}</Copy>}
            </View>
          )}
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>
              {dateLabel(selected.date)}
            </Text>
            <Copy muted>
              {Math.floor(asleepMinutes / 60)}h {asleepMinutes % 60}m asleep ·{" "}
              {selected.awakenings} awakenings
            </Copy>
          </View>
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: "row",
              gap: 6,
              padding: 4,
              borderRadius: 12,
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
                  onPress={() => setRange(value)}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: 9,
                    borderRadius: 9,
                    borderWidth: active ? 1 : 0,
                    borderColor: active ? c.border : "transparent",
                    backgroundColor: active ? c.card : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: active ? c.text : c.muted,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
          {!!note && selected.total != null && <Copy muted>{note}</Copy>}
          <SleepBreakdown score={selected} />
          <NavigationRow
            label="Manage health data"
            detail="Sync, permissions and imported history"
            onPress={() => router.push("/health")}
          />
        </>
      )}
      <Sheet
        visible={help}
        title="How your sleep score works"
        onClose={() => setHelp(false)}
      >
        <Copy>
          V0 uses sleep duration, your recent bedtime pattern and recorded
          interruptions. Duration counts up to 50 points, consistency up to 30
          and interruptions up to 20. Eight hours is a provisional reference,
          not a personal prescription.
        </Copy>
        <Copy>
          Learning or incomplete nights keep their recorded measurements and
          show no total. Missing nights never count as zero.
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
