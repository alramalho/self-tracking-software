import { View } from "react-native";
import { randomUUID } from "expo-crypto";
import { addMonths } from "date-fns";
import { Button, Copy, Field, Heading, Panel } from "@/components/ui";
import { DateField } from "@/components/DateField";
import { dayKey } from "@/core/dates";
import type { MilestoneFieldsProps } from "./types";
export function MilestoneFields({
  milestones,
  onChange,
}: MilestoneFieldsProps) {
  return (
    <View style={{ gap: 14 }}>
      <Heading>Set milestones (optional)</Heading>
      <Copy muted>Break your goal into smaller achievements</Copy>
      {milestones.map((m, index) => (
        <Panel key={m.id}>
          <Field
            label={`Milestone ${index + 1} title`}
            value={m.description}
            onChangeText={(description) =>
              onChange(
                milestones.map((row, i) =>
                  i === index ? { ...row, description } : row,
                ),
              )
            }
          />
          <DateField
            label={`Milestone ${index + 1} date`}
            value={m.date}
            includeTime={false}
            onChange={(date) =>
              onChange(
                milestones.map((row, i) =>
                  i === index ? { ...row, date } : row,
                ),
              )
            }
          />
        </Panel>
      ))}
      <Button
        secondary
        onPress={() => {
          const lastDate = milestones.at(-1)?.date;
          const parsed = lastDate ? new Date(lastDate) : new Date();
          const date =
            Number.isFinite(parsed.getTime()) && lastDate
              ? addMonths(parsed, 1)
              : new Date();
          onChange([
            ...milestones,
            {
              id: randomUUID(),
              description: "",
              date: dayKey(date),
              progress: 0,
            },
          ]);
        }}
      >
        Add Milestone
      </Button>
      {!!milestones.length && (
        <Button secondary onPress={() => onChange(milestones.slice(0, -1))}>
          Remove Last Milestone
        </Button>
      )}
    </View>
  );
}
