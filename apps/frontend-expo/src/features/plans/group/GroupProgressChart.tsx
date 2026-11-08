import { ActivityIndicator, Image, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Users } from "lucide-react-native";
import { Text } from "@/components/typography/Text";
import { Panel, s, useColors } from "@/components/ui";
import { api } from "@/data/api";
import { chartMax, memberBarColor, statusColors, statusLabels } from "./group-progress";
import type { GroupProgress, PlanSectionProps } from "../types";

const PLOT_HEIGHT = 160;

export function GroupProgressChart({ plan }: PlanSectionProps) {
  const c = useColors();
  const progress = useQuery({
    queryKey: ["plan-group-progress", plan.id],
    staleTime: 60000,
    queryFn: async () => {
      try {
        return (await api.get<GroupProgress>(`/plans/${plan.id}/group-progress`))
          .data;
      } catch (error) {
        // A plan without a group answers 400/403; the section stays hidden.
        if (isAxiosError(error) && [400, 403].includes(error.response?.status ?? 0))
          return null;
        throw error;
      }
    },
  });
  if (progress.isPending)
    return (
      <Panel style={{ alignItems: "center", paddingVertical: 48 }}>
        <ActivityIndicator color={c.muted} />
      </Panel>
    );
  const members = progress.data?.members ?? [];
  if (members.length <= 1) return null;
  const max = chartMax(members);
  return (
    <Panel testID="plan-group-progress" style={{ padding: 16, borderRadius: 16, gap: 16 }}>
      <View style={s.row}>
        <Users size={16} color={c.text} />
        <Text style={{ fontSize: 16, fontWeight: "600", color: c.text }}>
          Group Progress This Week
        </Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-around", gap: 8 }}>
        {members.map((member) => (
          <View
            key={member.userId}
            accessible
            accessibilityLabel={`${member.name}: ${member.weeklyActivityCount} of ${member.target} activities`}
            style={{ flex: 1, alignItems: "center", gap: 8, maxWidth: 96 }}
          >
            <View
              style={{
                height: PLOT_HEIGHT,
                flexDirection: "row",
                alignItems: "flex-end",
                gap: 4,
              }}
            >
              <View
                style={{
                  width: 18,
                  height: Math.max(4, (member.weeklyActivityCount / max) * PLOT_HEIGHT),
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                  backgroundColor: memberBarColor(member, c.accent, c.muted),
                }}
              />
              <View
                style={{
                  width: 18,
                  height: Math.max(4, (member.target / max) * PLOT_HEIGHT),
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                  backgroundColor: c.soft,
                }}
              />
            </View>
            {member.picture ? (
              <Image
                source={{ uri: member.picture }}
                style={{ width: 32, height: 32, borderRadius: 16 }}
              />
            ) : (
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: c.soft,
                }}
              >
                <Text style={{ color: c.muted, fontSize: 12, fontWeight: "500" }}>
                  {member.name[0]?.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ alignItems: "center" }}>
              <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12 }}>
                {member.name.split(" ")[0]}
              </Text>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>
                {member.weeklyActivityCount}/{member.target}
              </Text>
            </View>
          </View>
        ))}
      </View>
      {members.some((member) => member.status) && (
        <View
          style={{ gap: 8, borderTopWidth: 1, borderColor: c.border, paddingTop: 12 }}
        >
          <Text style={{ color: c.muted, fontSize: 12 }}>Progress Status:</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {(Object.keys(statusLabels) as (keyof typeof statusLabels)[]).map((key) => {
              const color = key === "NULL" ? c.muted : statusColors[key];
              return (
                <Text
                  key={key}
                  style={{
                    fontSize: 12,
                    color,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                    overflow: "hidden",
                    backgroundColor: key === "NULL" ? c.soft : `${color}1f`,
                  }}
                >
                  {statusLabels[key]}
                </Text>
              );
            })}
          </View>
        </View>
      )}
    </Panel>
  );
}
