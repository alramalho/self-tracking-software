import { useState } from "react";
import { Image, Switch, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Copy,
  Field,
  Panel,
  Sheet,
  Status,
  s,
  useColors,
} from "@/components/ui";
import { useCurrentUser } from "@/data/queries";
import { api } from "@/data/api";
import { coachIdentity } from "./coach";
import type { CoachSettingsProps } from "./types";
export function CoachSettings({ visible, onClose }: CoachSettingsProps) {
  const c = useColors();
  const user = useCurrentUser();
  const client = useQueryClient();
  const [hour, setHour] = useState<string>();
  const save = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      api.patch("/users/user", updates),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["current-user"] });
    },
  });
  return (
    <Sheet visible={visible} title="Coach settings" onClose={onClose}>
      <Copy muted>
        Once a week, your coach recaps the week you finished and lays out the
        week ahead in one message.
      </Copy>
      {(["CHAMPION", "STRATEGIST"] as const).map((personality) => {
        const identity = coachIdentity(personality);
        return (
          <Panel key={personality}>
            <View style={s.row}>
              <Image
                source={{ uri: identity.avatar }}
                style={{ width: 48, height: 48 }}
              />
              <View style={{ flex: 1 }}>
                <Copy>
                  {identity.name} · {identity.title}
                </Copy>
                <Copy muted>
                  {personality === "CHAMPION"
                    ? "Warm, encouraging, and focused on progress."
                    : "Direct, realistic, and focused on strategy."}
                </Copy>
              </View>
            </View>
            <Button
              secondary
              busy={save.isPending}
              onPress={() => save.mutate({ coachPersonality: personality })}
            >
              {(user.data?.coachPersonality ?? "CHAMPION") === personality
                ? `Selected: ${identity.name}`
                : `Choose ${identity.name}`}
            </Button>
          </Panel>
        );
      })}
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Copy>Weekly recap</Copy>
          <Copy muted>One message every Monday.</Copy>
        </View>
        <Switch
          accessibilityLabel="Weekly recap"
          value={user.data?.proactiveCoachingEnabled ?? true}
          onValueChange={(value) =>
            save.mutate({ proactiveCoachingEnabled: value })
          }
          disabled={save.isPending}
          trackColor={{ true: c.accent }}
        />
      </View>
      <Field
        label="Reachout hour (0–23)"
        keyboardType="number-pad"
        value={hour ?? String(user.data?.preferredCoachingHour ?? 6)}
        onChangeText={setHour}
      />
      <Button
        secondary
        busy={save.isPending}
        disabled={
          hour === undefined || !/^\d{1,2}$/.test(hour) || Number(hour) > 23
        }
        onPress={() => save.mutate({ preferredCoachingHour: Number(hour) })}
      >
        Save reachout time
      </Button>
      <Status error={save.error} />
    </Sheet>
  );
}
