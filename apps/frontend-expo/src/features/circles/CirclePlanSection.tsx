import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, Users } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Heading, Panel, s, useColors } from "@/components/ui";
import { PersonAvatar } from "./components";
import { circleStatusLine } from "./model";
import { defaultPreferences, useMyCircles } from "./api";
import { setPendingMatch } from "./pendingMatch";
import type { CirclePlanSectionProps } from "./types";

// Your plan's circle at a glance, or the way to find one. One circle per plan.
export function CirclePlanSection({ planId }: CirclePlanSectionProps) {
  const c = useColors();
  const mine = useMyCircles();
  if (!mine.data) return null;
  const circle = mine.data.find((each) => each.planId === planId);
  if (!circle)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Find a circle for this plan"
        onPress={() => {
          setPendingMatch({ planId, mode: "find", ...defaultPreferences });
          router.push(`/circle-match?planId=${planId}`);
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          minHeight: 56,
          paddingHorizontal: 16,
          borderRadius: 20,
          backgroundColor: c.card,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Users size={22} color={c.text} strokeWidth={1.8} />
        <Text style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: "600" }}>
          Find a circle for this plan
        </Text>
        <ChevronRight size={18} color={c.muted} />
      </Pressable>
    );
  const open = () => router.push(`/circle/${circle.id}`);
  const status = circleStatusLine(circle);
  return (
    <View style={{ gap: 10 }}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Heading>Circle</Heading>
        <Pressable accessibilityRole="link" accessibilityLabel={`Open ${circle.name}`} hitSlop={8} onPress={open}>
          <Text style={{ color: c.accent, fontSize: 15, fontWeight: "600" }}>Open ›</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${circle.name}, ${status}`}
        onPress={open}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Panel style={{ padding: 16, borderRadius: 16, gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Text numberOfLines={1} style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
              {`${circle.emoji} ${circle.name}`}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>{status}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {circle.people.map((person, i) => (
              <PersonAvatar
                key={i}
                name={person.name}
                picture={person.picture}
                size={26}
                ring={person.onTrack ? "on" : "off"}
              />
            ))}
          </View>
        </Panel>
      </Pressable>
    </View>
  );
}
