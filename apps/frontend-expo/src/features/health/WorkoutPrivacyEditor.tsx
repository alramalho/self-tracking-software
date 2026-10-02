import { useState } from "react";
import { Pressable, View } from "react-native";
import { Check, Lock, Users } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/typography/Text";
import { Button, Copy, Status, useColors } from "@/components/ui";
import { api } from "@/data/api";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import { ReviewRow } from "./review/controls";
import type { WorkoutPrivacyUpdateResult } from "./workout-types";

interface WorkoutPrivacyEditorProps {
  healthWorkoutId: string;
  isPublic: boolean;
  onClose: () => void;
}

export function WorkoutPrivacyEditor({
  healthWorkoutId,
  isPublic,
  onClose,
}: WorkoutPrivacyEditorProps) {
  const c = useColors();
  const client = useQueryClient();
  const [nextIsPublic, setNextIsPublic] = useState(isPublic);
  const [makeDefault, setMakeDefault] = useState(false);
  const update = useMutation({
    mutationFn: async () =>
      (
        await api.patch<WorkoutPrivacyUpdateResult>(
          "/health/apple/workouts/privacy",
          {
            healthWorkoutId,
            shareHealthData: nextIsPublic,
            makeDefault,
          },
        )
      ).data,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["health", "workouts"] }),
        client.invalidateQueries({ queryKey: ["activity-entries"] }),
        client.invalidateQueries({ queryKey: ["timeline"] }),
      ]);
      onClose();
    },
  });

  return (
    <LoggingDrawer
      title="Who can see Watch data?"
      titleAlign="left"
      testID="workout-privacy-editor"
      dismissLabel="Dismiss Watch data privacy"
      onClose={() => {
        if (!update.isPending) onClose();
      }}
    >
      <Copy>
        This changes privacy for this activity only. Your activity’s normal
        visibility stays the same.
      </Copy>
      <View
        style={{
          backgroundColor: c.soft,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <ReviewRow
          title="Private"
          detail="Only you can see heart rate, calories and exact timing"
          icon={Lock}
          selected={!nextIsPublic}
          disabled={update.isPending}
          onPress={() => setNextIsPublic(false)}
        />
        <View style={{ borderTopWidth: 1, borderColor: c.inputBorder }} />
        <ReviewRow
          title="Share with activity"
          detail="People who can see this activity can also see its Watch details"
          icon={Users}
          selected={nextIsPublic}
          disabled={update.isPending}
          onPress={() => setNextIsPublic(true)}
        />
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Make this my default for future Watch workouts"
        accessibilityState={{
          checked: makeDefault,
          disabled: update.isPending,
        }}
        disabled={update.isPending}
        onPress={() => setMakeDefault((value) => !value)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          minHeight: 52,
          opacity: update.isPending ? 0.45 : pressed ? 0.65 : 1,
        })}
      >
        <View
          style={{
            width: 22,
            height: 22,
            marginTop: 1,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: makeDefault ? c.accent : c.muted,
            backgroundColor: makeDefault ? c.accent : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {makeDefault && <Check size={15} color="#fff" strokeWidth={2.5} />}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: c.text, fontWeight: "600" }}>
            Make this my default for future Watch workouts
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>
            New workouts will start with this privacy choice. You can still
            change each activity later.
          </Text>
        </View>
      </Pressable>
      <Status error={update.error} />
      <Button
        testID="save-workout-privacy"
        busy={update.isPending}
        onPress={() => update.mutate()}
      >
        Save privacy
      </Button>
    </LoggingDrawer>
  );
}
