import { Switch, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text } from "@/components/typography/Text";
import { Status, useColors } from "@/components/ui";
import { api } from "@/data/api";
import type { ApiKeySummary } from "../settings/types";
import type { PlanSectionProps } from "./types";

// A connected agent exists when the person has an active API key. The toggle
// stays visible for an agent-managed plan so it can be handed back to the coach.
export function ConnectedAgentToggle({ plan }: PlanSectionProps) {
  const c = useColors();
  const client = useQueryClient();
  const keys = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () =>
      (await api.get<{ keys: ApiKeySummary[] }>("/api-keys")).data.keys,
  });
  const agentManaged = plan.contentPlanner === "EXTERNAL_AGENT";
  const planner = useMutation({
    mutationFn: async (external: boolean) =>
      api.patch("/plans/bulk-update", {
        updates: [
          {
            planId: plan.id,
            updates: { contentPlanner: external ? "EXTERNAL_AGENT" : "COACH" },
          },
        ],
      }),
    onSettled: () => client.invalidateQueries({ queryKey: ["plans"] }),
  });
  if (!agentManaged && !keys.data?.length) return null;
  return (
    <View
      testID="plan-connected-agent"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: c.text }}>
          Weeks planned by your connected AI
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 17, color: c.muted }}>
          Your connected agent plans this plan's weeks and keeps them synced —
          your coach stays on accountability and steps back in if the agent
          goes quiet.
        </Text>
        <Status error={planner.error} />
      </View>
      <Switch
        accessibilityLabel="Weeks planned by your connected AI"
        value={planner.isPending ? planner.variables : agentManaged}
        disabled={planner.isPending}
        onValueChange={(external) => planner.mutate(external)}
        trackColor={{ true: c.accent }}
      />
    </View>
  );
}
