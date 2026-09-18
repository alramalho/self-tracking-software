import { LoggingDrawer } from "./LoggingDrawer";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/data/api";
import { Copy, Field, Status, useColors } from "@/components/ui";
import { Text } from "@/components/typography/Text";
import {
  Entrance,
  FollowUpActions,
  FollowUpHeader,
} from "@/components/follow-up/Presentation";
import type { DifficultyStepProps } from "./types";

const options = [
  ["very_easy", "😌", "Very Easy"],
  ["easy", "🙂", "Easy"],
  ["moderate", "😐", "Moderate"],
  ["hard", "😤", "Hard"],
  ["very_hard", "🥵", "Very Hard"],
];
export function DifficultyStep({
  activity,
  entryId,
  initialNotes,
  onSkip,
  onSave,
}: DifficultyStepProps) {
  const c = useColors();
  const [selected, setSelected] = useState<string>();
  const [reasons, setReasons] = useState<string[]>([]);
  const [detail, setDetail] = useState(!!initialNotes);
  const [notes, setNotes] = useState(initialNotes);
  const suggestions = useQuery({
    queryKey: ["reflection-reasons", entryId, selected],
    enabled: !!selected,
    retry: false,
    queryFn: async ({ signal }) =>
      (
        await api.post<{ reasons: string[] }>(
          `/activities/activity-entries/${entryId}/reflection-reasons`,
          { difficulty: selected },
          { signal },
        )
      ).data.reasons,
  });
  const save = useMutation({
    mutationFn: () =>
      onSave(
        selected!,
        [
          reasons.length ? `Coach should know: ${reasons.join(", ")}.` : "",
          notes.trim(),
        ]
          .filter(Boolean)
          .join("\n") || undefined,
      ),
  });
  const reflection = selected === "hard" || selected === "very_hard" || detail;
  return (
    <LoggingDrawer
      contentPadding={40}
      keyboardToolbar
      onClose={() => {
        if (!save.isPending) onSkip();
      }}
    >
      <View testID="difficulty-follow-up" style={{ gap: 24 }}>
        <FollowUpHeader
          icon={
            <Text style={{ fontSize: 60, lineHeight: 72 }}>
              {activity.emoji}
            </Text>
          }
          title={`How hard was ${activity.title}?`}
          description="This helps track your perceived effort over time."
        />
        <Entrance delay={400}>
          <View style={{ gap: 8 }}>
            {options.map(([value, emoji, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{
                  selected: selected === value,
                  disabled: save.isPending,
                }}
                disabled={save.isPending}
                onPress={() => {
                  if (selected !== value) {
                    setSelected(value);
                    setReasons([]);
                  }
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  minHeight: 56,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: selected === value ? c.accent : c.border,
                  backgroundColor:
                    selected === value ? `${c.accent}1a` : c.card,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
                <Text
                  style={{ color: c.text, fontWeight: "500", fontSize: 16 }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Entrance>
        {selected && (
          <Entrance>
            <View style={{ gap: 12 }}>
              {reflection && (
                <>
                  <Text
                    style={{ color: c.text, fontSize: 14, fontWeight: "500" }}
                  >
                    What should your coach know?
                  </Text>
                  {suggestions.isFetching && (
                    <Copy muted>Loading options...</Copy>
                  )}
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {suggestions.data?.map((reason) => (
                      <Pressable
                        key={reason}
                        accessibilityRole="button"
                        accessibilityLabel={reason}
                        accessibilityState={{
                          selected: reasons.includes(reason),
                        }}
                        disabled={save.isPending}
                        onPress={() =>
                          setReasons((current) =>
                            current.includes(reason)
                              ? current.filter((r) => r !== reason)
                              : [...current, reason],
                          )
                        }
                        style={{
                          borderWidth: 1,
                          borderColor: reasons.includes(reason)
                            ? c.accent
                            : c.border,
                          backgroundColor: reasons.includes(reason)
                            ? `${c.accent}1a`
                            : c.card,
                          borderRadius: 24,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: reasons.includes(reason) ? c.text : c.muted,
                            fontSize: 14,
                          }}
                        >
                          {reason}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
              {detail ? (
                <Field
                  label="Private reflection"
                  placeholder="Add a private reflection..."
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  editable={!save.isPending}
                  style={{ minHeight: 84 }}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={save.isPending}
                  onPress={() => setDetail(true)}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={{ color: c.muted }}>
                    {reflection ? "Add detail" : "Add reflection"}
                  </Text>
                </Pressable>
              )}
              {reflection && (
                <Text style={{ fontSize: 12, color: c.muted }}>
                  Reflection is private to you and your coach.
                </Text>
              )}
            </View>
          </Entrance>
        )}
        <Status error={save.error} />
        <Entrance delay={500}>
          <FollowUpActions
            onSkip={onSkip}
            onDone={() => save.mutate()}
            disabled={!selected}
            busy={save.isPending}
          />
        </Entrance>
      </View>
    </LoggingDrawer>
  );
}
