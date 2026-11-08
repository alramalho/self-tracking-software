import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Text } from "@/components/typography/Text";
import { Button, Copy, Heading, Panel, Sheet, Status, useColors } from "@/components/ui";
import { api } from "@/data/api";
import { useAction, useCurrentUser } from "@/data/queries";
import { GroupProgressChart } from "./GroupProgressChart";
import type { PlanGroupSectionProps } from "../types";

export function PlanGroupSection({ plan, own }: PlanGroupSectionProps) {
  const c = useColors();
  const user = useCurrentUser();
  const [leaving, setLeaving] = useState(false);
  const leave = useAction(async () =>
    api.post(`/plans/leave-plan-group/${plan.id}`),
  );
  const members = (plan.planGroup?.members ?? []).filter((m) => !m.leftAt);
  if (!plan.planGroupId && !plan.planGroup) return null;
  return (
    <View testID="plan-group-section" style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Heading>Group Progress</Heading>
        <Copy muted>See how your plan group is progressing this week</Copy>
      </View>
      <GroupProgressChart plan={plan} />
      {members.length >= 2 && (
        <Panel style={{ padding: 16, borderRadius: 16, gap: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600", color: c.text }}>
              People in this plan
            </Text>
            {own && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setLeaving(true)}
                style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}
              >
                <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "500" }}>
                  Leave Group
                </Text>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
            {members.map(({ user: member }) => (
              <Pressable
                key={member.id}
                accessibilityRole="link"
                accessibilityLabel={`View ${member.name || member.username}'s profile`}
                onPress={() => router.push(`/profile/${member.username}`)}
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                {member.picture ? (
                  <Image
                    source={{ uri: member.picture }}
                    style={{ width: 48, height: 48, borderRadius: 24 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: c.soft,
                    }}
                  >
                    <Text style={{ fontSize: 20, color: c.text }}>
                      {(member.name || member.username || "U")[0]}
                    </Text>
                  </View>
                )}
                <Text style={{ fontSize: 17, color: c.text }}>
                  {member.username === user.data?.username
                    ? "You"
                    : member.name || member.username}
                </Text>
              </Pressable>
            ))}
          </View>
        </Panel>
      )}
      <Sheet
        visible={leaving}
        title="Leave Plan Group"
        onClose={() => setLeaving(false)}
      >
        <Copy>
          You'll leave this group but your plan and activities will remain
          intact. You can continue working on your plan independently.
        </Copy>
        <Button
          danger
          busy={leave.isPending}
          onPress={() =>
            leave.mutate(undefined, { onSuccess: () => setLeaving(false) })
          }
        >
          Leave Group
        </Button>
        <Button
          secondary
          disabled={leave.isPending}
          onPress={() => setLeaving(false)}
        >
          Cancel
        </Button>
        <Status error={leave.error} />
      </Sheet>
    </View>
  );
}
