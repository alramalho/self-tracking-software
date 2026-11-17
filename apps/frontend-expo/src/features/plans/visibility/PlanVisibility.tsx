import { useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronRight, Earth, EyeOff, Lock } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { useColors } from "@/components/theme";
import { Drawer, DrawerButton, DrawerHeader } from "@/components/drawer/Drawer";
import { usePlans } from "@/data/queries";
import { ChoiceRow } from "../ChoiceRow";
import { sharedLogNote, visibilityLabel, visibilityOptions } from "./model";
import type { PlanVisibilityChoicesProps, PlanVisibilityRowProps } from "./types";

const icons = { PUBLIC: Earth, LOGS_ONLY: EyeOff, PRIVATE: Lock };

// Everyone / Hide the plan / Hide everything, with a note when a shared activity keeps showing.
export function PlanVisibilityChoices({
  value,
  onChange,
  activityIds,
  planId,
}: PlanVisibilityChoicesProps) {
  const c = useColors();
  const plans = usePlans();
  const note = sharedLogNote(value, activityIds, plans.data ?? [], planId);
  return (
    <View style={{ gap: 10 }}>
      {visibilityOptions.map((option) => (
        <ChoiceRow
          key={option.value}
          icon={icons[option.value]}
          label={option.label}
          description={option.description}
          selected={value === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
      {note ? (
        <Text
          testID="plan-visibility-shared-note"
          style={{ color: c.muted, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 }}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

// "Who sees it · Everyone ›" on the new plan's review, opening the choices in a drawer.
export function PlanVisibilityRow({ value, onChange, activityIds }: PlanVisibilityRowProps) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const Icon = icons[value];
  return (
    <>
      <Pressable
        testID="plan-visibility-row"
        accessibilityRole="button"
        accessibilityLabel={`Who sees it: ${visibilityLabel(value)}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: 56,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 18,
          borderRadius: 16,
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.inputBorder,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon size={22} color={c.muted} strokeWidth={1.8} />
        <Text style={{ flex: 1, color: c.text, fontSize: 16, fontWeight: "500" }}>
          Who sees it
        </Text>
        <Text style={{ color: c.muted, fontSize: 15 }}>{visibilityLabel(value)}</Text>
        <ChevronRight size={18} color={c.muted} />
      </Pressable>
      <Drawer visible={open} label="Who sees this plan?" onClose={() => setOpen(false)}>
        <DrawerHeader title="Who sees this plan?" />
        <PlanVisibilityChoices value={value} onChange={onChange} activityIds={activityIds} />
        <DrawerButton label="Done" onPress={() => setOpen(false)} />
      </Drawer>
    </>
  );
}
