import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import { reactionPeople } from "./people";
import type { ReactionPeopleProps } from "./types";

export function ReactionPeople({
  selection,
  reactions,
  onClose,
}: ReactionPeopleProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [filter, setFilter] = useState<string>();
  useEffect(() => setFilter(selection?.emoji), [selection]);
  useEffect(() => {
    onClose();
  }, [window.width, window.height]);
  const people = reactionPeople(reactions, filter);
  const emojis = [...new Set(reactions.map((reaction) => reaction.emoji))];
  const width = Math.min(300, window.width - insets.left - insets.right - 16);
  const anchor = selection?.anchor;
  const above = anchor ? anchor.y - insets.top - 16 : 0;
  const below = anchor
    ? window.height - insets.bottom - anchor.y - anchor.height - 16
    : 0;
  const desiredHeight = Math.min(370, 112 + Math.max(1, people.length) * 56);
  const opensAbove = above >= desiredHeight || above > below;
  const height = Math.min(
    desiredHeight,
    Math.max(160, opensAbove ? above : below),
    window.height - insets.top - insets.bottom - 16,
  );
  const left = Math.max(
    insets.left + 8,
    Math.min(anchor?.x ?? 8, window.width - insets.right - width - 8),
  );
  const top = Math.max(
    insets.top + 8,
    Math.min(
      opensAbove
        ? (anchor?.y ?? 0) - height - 8
        : (anchor?.y ?? 0) + (anchor?.height ?? 0) + 8,
      window.height - insets.bottom - height - 8,
    ),
  );
  return (
    <Modal
      visible={!!selection}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {selection && (
        <View
          style={{ flex: 1 }}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss reaction people"
            testID="reaction-people-backdrop"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          <View
            testID="reaction-people"
            style={{
              position: "absolute",
              left,
              top,
              width,
              height,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
              padding: 12,
              shadowColor: "#000",
              shadowOpacity: 0.22,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 6 },
              elevation: 12,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  color: c.text,
                  fontSize: 16,
                  fontWeight: "600",
                  paddingLeft: 4,
                }}
              >
                Reactions
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close reaction people"
                onPress={onClose}
                style={{
                  width: 40,
                  height: 40,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color={c.muted} />
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginBottom: 8 }}
              contentContainerStyle={{ gap: 6 }}
            >
              {[undefined, ...emojis].map((emoji) => (
                <Pressable
                  key={emoji ?? "all"}
                  accessibilityRole="button"
                  accessibilityLabel={
                    emoji ? `Show ${emoji} reactions` : "Show all reactions"
                  }
                  accessibilityState={{ selected: filter === emoji }}
                  onPress={() => setFilter(emoji)}
                  style={{
                    minHeight: 36,
                    borderRadius: 18,
                    justifyContent: "center",
                    paddingHorizontal: 12,
                    backgroundColor: filter === emoji ? c.selectedBg : c.soft,
                  }}
                >
                  <Text
                    style={{
                      color: filter === emoji ? c.bright : c.text,
                      fontSize: 14,
                    }}
                  >
                    {emoji ?? "All"} {reactionPeople(reactions, emoji).length}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView
              testID="reaction-people-list"
              style={{ flex: 1 }}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
            >
              {people.map((person) => {
                const username = person.user?.username;
                const name = person.user?.name ?? username ?? "Someone";
                return (
                  <Pressable
                    key={person.key}
                    accessibilityRole={username ? "button" : undefined}
                    accessibilityLabel={
                      username
                        ? `View @${username}'s profile`
                        : "Reactor profile unavailable"
                    }
                    disabled={!username}
                    onPress={() => {
                      onClose();
                      router.push(`/profile/${encodeURIComponent(username!)}`);
                    }}
                    style={{
                      minHeight: 56,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingHorizontal: 4,
                    }}
                  >
                    {person.user?.picture ? (
                      <Image
                        source={{ uri: person.user.picture }}
                        style={{ width: 34, height: 34, borderRadius: 17 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          backgroundColor: c.soft,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: c.muted }}>
                          {name[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: c.text,
                          fontSize: 14,
                          fontWeight: "500",
                        }}
                      >
                        {name}
                      </Text>
                      {username && (
                        <Text
                          numberOfLines={1}
                          style={{ color: c.muted, fontSize: 12 }}
                        >
                          @{username}
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 16 }}>
                      {person.emojis.join(" ")}
                    </Text>
                  </Pressable>
                );
              })}
              {!people.length && (
                <Text style={{ color: c.muted, padding: 12 }}>
                  No reactions yet
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </Modal>
  );
}
