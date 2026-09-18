import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronDown, ChevronUp, FileText } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Button, Field, Panel, Status, s, useColors } from "@/components/ui";
import { Pencil } from "lucide-react-native";
import { api } from "@/data/api";
import { useAction } from "@/data/queries";
import { PlanNotesText } from "./PlanNotesText";
import type { PlanNotesProps } from "./types";

export function PlanNotes({ plan, own }: PlanNotesProps) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(plan.notes?.trim() ?? "");
  useEffect(() => {
    if (!editing) setNotes(plan.notes?.trim() ?? "");
  }, [plan.notes, editing]);
  const save = useAction(async () =>
    api.post("/plans/upsert", { id: plan.id, notes: notes.trim() || null }),
  );
  return (
    <Panel
      testID="plan-notes-island"
      style={{ padding: 16, borderRadius: 16, gap: 0 }}
    >
      <View style={[s.row, { gap: 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Plan notes"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={[s.row, { flex: 1, minWidth: 0, gap: 12, minHeight: 44 }]}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: c.dark ? "#27272a99" : "#f4f4f599",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FileText size={20} color={c.muted} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>
              Plan notes
            </Text>
            <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12 }}>
              Roadmap, sources, constraints, and coach context
            </Text>
          </View>
          {expanded ? (
            <ChevronUp size={20} color={c.muted} />
          ) : (
            <ChevronDown size={20} color={c.muted} />
          )}
        </Pressable>
        {own && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit plan notes"
            onPress={() => {
              setNotes(plan.notes?.trim() ?? "");
              setExpanded(true);
              setEditing(true);
            }}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pencil size={16} color={c.muted} />
          </Pressable>
        )}
      </View>
      {expanded && (
        <View
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderColor: c.border,
            gap: 16,
          }}
        >
          {editing ? (
            <>
              <Field
                label="Plan notes"
                multiline
                value={notes}
                onChangeText={setNotes}
                editable={!save.isPending}
                placeholder="Roadmap, sources, constraints, baseline, or anything the coach should keep following"
                style={{
                  minHeight: 160,
                  textAlignVertical: "top",
                  fontSize: 14,
                  lineHeight: 22,
                  borderRadius: 12,
                  backgroundColor: c.bg,
                }}
              />
              {!!notes.trim() && (
                <View style={{ gap: 8 }}>
                  <Text
                    style={{
                      color: c.muted,
                      fontSize: 12,
                      fontWeight: "500",
                      letterSpacing: 0.5,
                    }}
                  >
                    PREVIEW
                  </Text>
                  <PlanNotesText notes={notes.trim()} />
                </View>
              )}
              <Status error={save.error} />
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Button
                    busy={save.isPending}
                    onPress={() =>
                      save.mutate(undefined, {
                        onSuccess: () => {
                          setEditing(false);
                          setExpanded(!!notes.trim());
                        },
                      })
                    }
                  >
                    Save
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    secondary
                    disabled={save.isPending}
                    onPress={() => {
                      setNotes(plan.notes?.trim() ?? "");
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                </View>
              </View>
            </>
          ) : (
            <PlanNotesText notes={plan.notes?.trim() || "No notes yet."} />
          )}
        </View>
      )}
    </Panel>
  );
}
