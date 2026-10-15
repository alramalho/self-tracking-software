import { View } from "react-native";
import { ArrowDown } from "lucide-react-native";
import { Copy, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { formatPreviewMeasure } from "./model";
import type { ActivityLineProps, MergeStepProps } from "./types";

function count(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function ActivityLine({ activity, note, faded }: ActivityLineProps) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: faded ? 0.6 : 1 }}>
      <Text style={{ fontSize: 22 }}>{activity.emoji}</Text>
      <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontWeight: "600", fontSize: 16 }}>
        {activity.title}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13 }}>{note}</Text>
    </View>
  );
}

/** Shows which activity goes away and what moves into the one that stays. */
export function MergeStep({ suggestion }: MergeStepProps) {
  const c = useColors();
  const { keep, remove, entriesToMove, plansToUpdate, conversion } = suggestion;
  const moving = [
    entriesToMove > 0 && count(entriesToMove, "log"),
    plansToUpdate > 0 && count(plansToUpdate, "plan"),
  ].filter(Boolean);
  return (
    <>
      <Copy muted>
        {suggestion.match === "meaning"
          ? `${remove.title} looks like the same activity as ${keep.title}.`
          : `${remove.title} and ${keep.title} look like the same activity.`}
      </Copy>
      <View
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.inputBorder,
          backgroundColor: c.card,
          padding: 14,
          gap: 10,
        }}
      >
        <ActivityLine activity={remove} note={moving.length ? moving.join(" · ") : "nothing logged"} faded />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingLeft: 4 }}>
          <ArrowDown size={16} color={c.muted} />
          {conversion && (
            <Text style={{ color: c.muted, fontSize: 13 }}>
              1 {formatPreviewMeasure(conversion.from, 1)} = {conversion.factor}{" "}
              {conversion.to}
            </Text>
          )}
        </View>
        <ActivityLine
          activity={keep}
          note={
            conversion?.activityId === keep.id
              ? `stays, in ${conversion.to}`
              : "stays"
          }
        />
      </View>
      <Copy muted>
        Logs keep their dates, photos and comments. {remove.title} leaves your
        activity list.
      </Copy>
    </>
  );
}
