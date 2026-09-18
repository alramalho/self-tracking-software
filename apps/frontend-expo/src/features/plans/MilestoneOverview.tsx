import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/typography/Text";
import {
  ChevronDown,
  ChevronRight,
  Flag,
  Minus,
  Pencil,
  Plus,
  CheckCircle2,
} from "lucide-react-native";
import { format, startOfToday } from "date-fns";
import {
  Copy,
  Heading,
  IconButton,
  Panel,
  Status,
  useColors,
  s,
} from "@/components/ui";
import { useAction } from "@/data/queries";
import { api } from "@/data/api";
import type { MilestoneChange, MilestoneOverviewProps } from "./types";
export function MilestoneOverview({
  milestones,
  own,
  onEdit,
}: MilestoneOverviewProps) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const action = useAction(({ id, delta }: MilestoneChange) =>
    api.post(`/plans/milestones/${id}/modify`, { delta }),
  );
  const sorted = [...milestones].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const current = sorted.find((m) => (m.progress ?? 0) < 100) ?? sorted.at(-1);
  if (!current) return null;
  return (
    <Panel style={{ padding: 16, borderRadius: 16 }}>
      <View style={s.row}>
        <Flag size={22} color={c.muted} />
        <View style={{ flex: 1 }}>
          <Heading>Milestones</Heading>
          <Copy muted>
            {sorted.filter((m) => (m.progress ?? 0) >= 100).length}/
            {sorted.length} complete
          </Copy>
        </View>
        {sorted.length > 1 && (
          <IconButton
            label={expanded ? "Collapse milestones" : "Expand milestones"}
            icon={expanded ? ChevronDown : ChevronRight}
            onPress={() => setExpanded(!expanded)}
          />
        )}
        {own && (
          <IconButton label="Edit milestones" icon={Pencil} onPress={onEdit} />
        )}
      </View>
      {(expanded ? sorted : [current]).map((m) => {
        const progress = Math.min(100, Math.max(0, m.progress ?? 0));
        const complete = progress >= 100;
        const pastDue = !complete && new Date(m.date) < startOfToday();
        const Marker = complete ? CheckCircle2 : Flag;
        return (
          <View
            key={m.id}
            testID={`milestone-${m.id}`}
            style={[s.row, { alignItems: "flex-start" }]}
          >
            <Marker
              size={22}
              color={complete ? "#22c55e" : pastDue ? "#d97706" : c.muted}
            />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Copy>{m.description}</Copy>
                  <Copy muted>
                    {format(new Date(m.date), "EEE, MMM d")}
                    {pastDue ? " · past due" : ""}
                  </Copy>
                </View>
                <Copy muted>{progress}%</Copy>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: progress }}
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: c.soft,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${progress}%`,
                    height: 6,
                    backgroundColor: complete ? "#22c55e" : c.accent,
                  }}
                />
              </View>
              <View style={s.row}>
                <Text style={{ flex: 1, color: c.muted, fontSize: 12 }}>
                  {typeof m.criteria === "string"
                    ? m.criteria
                    : m.criteria
                      ? JSON.stringify(m.criteria)
                      : ""}
                </Text>
                {own && (
                  <>
                    <IconButton
                      label="Decrease milestone progress"
                      icon={Minus}
                      disabled={action.isPending || progress <= 0}
                      onPress={() => action.mutate({ id: m.id, delta: -10 })}
                    />
                    <IconButton
                      label="Increase milestone progress"
                      icon={Plus}
                      disabled={action.isPending || complete}
                      onPress={() => action.mutate({ id: m.id, delta: 10 })}
                    />
                  </>
                )}
              </View>
            </View>
          </View>
        );
      })}
      <Status error={action.error} />
    </Panel>
  );
}
