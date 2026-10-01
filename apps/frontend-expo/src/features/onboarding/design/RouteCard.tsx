import { Image, Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { shortDate } from "./format";
import type { RouteCardProps } from "./types";

const art = {
  Helly: require("../../../../assets/coaches/helly-3d.png"),
  Oli: require("../../../../assets/coaches/oli-3d.png"),
};
export const days = (o: { daysMin: number; daysMax: number }) => (o.daysMin === o.daysMax ? `${o.daysMin}` : `${o.daysMin}–${o.daysMax}`);
const label = { steady: "Moderate", focused: "Intense" } as const;

// The old web plan card, kept: coach, intensity, days a week, length and finish date.
export function RouteCard({ option, selected, onPress }: RouteCardProps) {
  const c = useColors();
  return (
    <Pressable
      testID={`route-${option.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${option.coach}, ${label[option.id]}. ${days(option)} days per week. ${option.estimatedWeeks} weeks, finish ${shortDate(option.finishingDate)}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        padding: 18,
        borderRadius: 22,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.accent : c.inputBorder,
        backgroundColor: c.card,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Image source={art[option.coach]} style={{ width: 64, height: 64 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: c.text, fontSize: 19, fontWeight: "700" }}>
          {option.coach} · {label[option.id]}
        </Text>
        <Text style={{ color: c.muted, fontSize: 15 }}>{days(option)} days per week</Text>
        <Text style={{ color: c.muted, fontSize: 15 }}>
          {option.estimatedWeeks} weeks · Finish {shortDate(option.finishingDate)}
        </Text>
      </View>
    </Pressable>
  );
}
