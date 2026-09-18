import { radii } from "@/components/radii";
import { useRefresh } from "@/data/useRefresh";
import { ChevronRight, Mic, Pencil, Plus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Text } from "@/components/typography/Text";
import { useLocalSearchParams, router } from "expo-router";
import { useActivities, useEntries } from "@/data/queries";
import { Screen, Status, useColors } from "@/components/ui";
import type { Activity } from "@/core/types";
import { Logger } from "./Logger";
import { ActivityEditor } from "./ActivityEditor";
import { VoiceLogDrawer } from "@/features/voice-log/VoiceLogDrawer";
import { usePendingVoiceLog } from "@/features/voice-log/usePendingVoiceLog";
export default function LogScreen() {
  const activities = useActivities();
  const entries = useEntries();
  const c = useColors();
  const { refresh, refreshing } = useRefresh("activities", "activity-entries");
  const { width } = useWindowDimensions();
  const cols = width >= 640 ? 3 : 2;
  const tileWidth = (Math.min(width, 672) - 32 - (cols - 1) * 16) / cols;
  const [selected, setSelected] = useState<Activity>();
  const [editing, setEditing] = useState<Activity | null>();
  const [voiceLogOpen, setVoiceLogOpen] = useState(false);
  const pendingVoice = usePendingVoiceLog();
  const voiceAccent = `${c.accent}99`;
  const { activityId, date } = useLocalSearchParams<{
    activityId?: string;
    date?: string;
  }>();
  useEffect(() => {
    if (activityId && activities.data) {
      setSelected(activities.data.find((a) => a.id === activityId));
    }
  }, [activityId, activities.data]);
  const sorted = useMemo(() => {
    const counts = new Map<string, number>();
    entries.data
      ?.filter((e) => !e.deletedAt && e.activityId)
      .forEach((e) =>
        counts.set(e.activityId!, (counts.get(e.activityId!) ?? 0) + 1),
      );
    return [...(activities.data ?? [])]
      .filter((a) => !a.deletedAt)
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, [activities.data, entries.data]);
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Status
        loading={activities.isPending}
        error={activities.error}
        retry={() => void activities.refetch()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log voice note"
        testID="log-voice-note-card"
        onPress={() => setVoiceLogOpen(true)}
        style={({ pressed }) => ({
          minHeight: 82,
          marginTop: 8,
          marginBottom: 4,
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <Mic size={32} color={voiceAccent} strokeWidth={1.8} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>
            {pendingVoice.draft ? "Review voice note" : "Log voice note"}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>
            {pendingVoice.draft
              ? "Your previous note is waiting for confirmation."
              : "Say what you did. Review the suggestions before saving."}
          </Text>
        </View>
        <ChevronRight size={19} color={c.muted} />
      </Pressable>
      <Text
        accessibilityRole="header"
        style={{ color: c.text, fontSize: 24, fontWeight: "700" }}
      >
        Log Activity
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 16,
          marginVertical: 8,
        }}
      >
        {sorted.map((activity) => (
          <View
            key={activity.id}
            style={{
              width: tileWidth,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Log ${activity.title}`}
              testID="activity-card"
              onPress={() => setSelected(activity)}
              style={{
                aspectRatio: 1,
                justifyContent: "center",
                padding: 24,
                borderRadius: radii.card,
                borderWidth: 2,
                borderColor: c.border,
                backgroundColor: c.card,
              }}
            >
              <Text style={{ fontSize: 36, marginBottom: 8 }}>
                {activity.emoji}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: "500", color: c.text }}>
                {activity.title}
              </Text>
              <Text style={{ fontSize: 14, color: c.muted }}>
                {activity.measure}
              </Text>
              <View
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  backgroundColor: activity.colorHex ?? "transparent",
                }}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${activity.title}`}
              onPress={() => setEditing(activity)}
              style={{ position: "absolute", right: 4, top: 4, padding: 10 }}
            >
              <Pencil size={18} color={c.muted} />
            </Pressable>
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add New"
          onPress={() => setEditing(null)}
          style={{
            width: tileWidth,
            aspectRatio: 1,
            padding: 24,
            justifyContent: "center",
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: c.border,
            borderRadius: radii.card,
          }}
        >
          <Plus size={32} color={c.muted} />
          <Text style={{ fontSize: 20, color: c.muted }}>Add New</Text>
        </Pressable>
      </View>
      {selected && (
        <Logger
          key={selected.id}
          activity={selected}
          initialDate={date ? new Date(date) : undefined}
          onClose={() => {
            setSelected(undefined);
            router.setParams({ activityId: undefined, date: undefined });
          }}
        />
      )}
      {editing !== undefined && (
        <ActivityEditor
          key={editing?.id ?? "new"}
          activity={editing ?? undefined}
          onClose={() => setEditing(undefined)}
        />
      )}
      {voiceLogOpen && (
        <VoiceLogDrawer
          initialDraft={pendingVoice.draft}
          onPendingChange={pendingVoice.sync}
          onClose={() => setVoiceLogOpen(false)}
        />
      )}
    </Screen>
  );
}
