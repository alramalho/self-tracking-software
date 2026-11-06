import { Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { PersonAvatar } from "@/features/circles/components";
import type { ProfileCardProps } from "./types";

/** Top of Settings: who you are and which plan you're on. Opens Account. */
export function ProfileCard({ name, username, picture, planType, onPress }: ProfileCardProps) {
  const c = useColors();
  const plan = (planType || "FREE").charAt(0) + (planType || "FREE").slice(1).toLowerCase();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account"
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: c.card,
        borderRadius: 20,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <PersonAvatar name={name || username || null} picture={picture} size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
          {name || username || "Your account"}
        </Text>
        <Text numberOfLines={1} style={{ color: c.muted, fontSize: 14 }}>
          {[username && `@${username}`, `${plan} plan`].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <ChevronRight size={18} color={c.muted} />
    </Pressable>
  );
}
