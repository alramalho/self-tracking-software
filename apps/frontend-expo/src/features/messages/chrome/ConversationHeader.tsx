import { Image, View } from "react-native";
import { ArrowLeft, EllipsisVertical } from "lucide-react-native";
import { useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import { IconButton } from "../IconButton";
import type { ConversationHeaderProps } from "../types";

// Identity and conversation-level actions. The thread below it scrolls; this does not.
export function ConversationHeader({
  title,
  coach,
  avatar,
  onBack,
  onOpenMenu,
  onOpenPersonMenu,
}: ConversationHeaderProps) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 4,
      }}
    >
      <IconButton label="Back to messages" onPress={onBack}>
        <ArrowLeft color={c.text} size={22} />
      </IconButton>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
        {avatar && (
          <Image
            source={avatar}
            resizeMode="contain"
            style={{ width: 34, height: 34 }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ color: c.text, fontSize: 16, fontWeight: "600" }}
          >
            {title}
          </Text>
          {coach && (
            <Text style={{ color: c.muted, fontSize: 12 }}>AI Coach</Text>
          )}
        </View>
      </View>
      {coach && (
        <IconButton label="Conversation options" onPress={onOpenMenu}>
          <EllipsisVertical size={20} color={c.text} />
        </IconButton>
      )}
      {onOpenPersonMenu && (
        <IconButton label="Conversation options" onPress={onOpenPersonMenu}>
          <EllipsisVertical size={20} color={c.text} />
        </IconButton>
      )}
    </View>
  );
}
