import { Image, Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import { pickHomeCoachNote } from "@tsw/prisma/home-todo";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { coachIdentity } from "@/features/messages/coach";
import { getChats } from "@/features/messages/service";
import type { CoachNoteProps } from "./types";

/** The latest weekly recap, only while it is unread and recent. */
export function CoachNote({ user }: CoachNoteProps) {
  const c = useColors();
  const chats = useQuery({ queryKey: ["chats"], queryFn: getChats });
  const chat = chats.data?.find(
    (chat) => chat.type === "COACH" && chat.latestCoachMessage,
  );
  const note = pickHomeCoachNote({
    preview: chat?.latestCoachMessage,
    planType: user?.planType,
    proactiveCoachingEnabled: user?.proactiveCoachingEnabled,
    now: new Date(),
  });
  if (!chat || !note) return null;
  const coach = coachIdentity(user?.coachPersonality);
  return (
    <Pressable
      testID="home-coach-note"
      accessibilityRole="button"
      accessibilityLabel={`${coach.name}: ${note.text}`}
      onPress={() => router.push(`/chat/${chat.id}`)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: c.card,
      }}
    >
      <Image
        source={
          user?.coachPersonality === "STRATEGIST"
            ? require("../../../../assets/coaches/oli.png")
            : require("../../../../assets/coaches/helly.png")
        }
        style={{ width: 40, height: 40 }}
        resizeMode="contain"
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.muted, fontSize: 12 }}>
          {coach.name} ·{" "}
          {formatDistanceToNow(note.createdAt, { addSuffix: true })}
        </Text>
        <Text numberOfLines={2} style={{ color: c.text, fontSize: 15, lineHeight: 20 }}>
          {note.text}
        </Text>
      </View>
      <ChevronRight size={18} color={c.muted} />
    </Pressable>
  );
}
