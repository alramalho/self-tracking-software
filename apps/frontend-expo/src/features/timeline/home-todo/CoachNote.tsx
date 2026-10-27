import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { pickCoachNote } from "@tsw/prisma/home-todo";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/ui";
import { useCurrentUser } from "@/data/queries";
import { coachAvatar } from "@/features/coach/avatar";
import { CoachItemDrawer } from "@/features/coach/inbox/CoachItemDrawer";
import { useCoachInbox } from "@/features/coach/inbox/useCoachInbox";
import type { CoachItem } from "@/features/coach/types";

/** The one Coach tab item worth a note on the homepage; most days there is none. */
export function CoachNote() {
  const c = useColors();
  const user = useCurrentUser();
  const inbox = useCoachInbox();
  const [open, setOpen] = useState<CoachItem>();
  const note = pickCoachNote(inbox.items);
  if (!note) return null;
  return (
    <>
      <Pressable
        testID="home-coach-note"
        accessibilityRole="button"
        accessibilityLabel={`${note.title}. ${note.label}`}
        onPress={() => setOpen(note)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 20,
          backgroundColor: c.card,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Image
          source={coachAvatar(user.data?.coachPersonality === "STRATEGIST")}
          style={{ width: 40, height: 40 }}
        />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={2} style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>
            {note.title}
          </Text>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>
            {note.label}
          </Text>
        </View>
        <ChevronRight size={18} color={c.muted} />
      </Pressable>
      <CoachItemDrawer item={open} onClose={() => setOpen(undefined)} />
    </>
  );
}
