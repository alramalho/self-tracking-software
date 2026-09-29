import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Users } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { PersonAvatar } from "@/features/circles/components";
import { circleStatusLine } from "@/features/circles/model";
import type { CirclePreviewProps } from "./types";

/** A circle next to the plans: who is in it, and whether the week is going well for them. */
export function CirclePreview({ circle }: CirclePreviewProps) {
  const c = useColors();
  const status = circleStatusLine(circle);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${circle.name}, ${status}`}
      onPress={() => router.push(`/circle/${circle.id}`)}
      style={({ pressed }) => ({
        aspectRatio: 1,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        padding: 16,
        justifyContent: "space-between",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Users size={26} color={c.bright} />
      <View style={{ gap: 4 }}>
        <Text numberOfLines={2} style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
          {circle.name}
        </Text>
        <Text numberOfLines={2} style={{ color: c.muted, fontSize: 13 }}>
          {status}
        </Text>
      </View>
      <View style={{ flexDirection: "row", paddingLeft: 6 }}>
        {circle.people.map((person, i) => (
          <View key={i} style={{ marginLeft: -6 }}>
            <PersonAvatar
              name={person.name}
              picture={person.picture}
              size={22}
              ring={person.onTrack ? "on" : "off"}
            />
          </View>
        ))}
      </View>
    </Pressable>
  );
}
