import { Reveal } from "@/components/reveal/Reveal";
import { useRefresh } from "@/data/useRefresh";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/data/api";
import type { Plan } from "@/core/types";
import type { PlanOrderChange } from "./types";
import { PlanTile } from "./PlanTile";
import { reorderVisiblePlans } from "./reorder";
import { useEffect, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Text } from "@/components/typography/Text";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Copy, Screen, Status, useColors } from "@/components/ui";
import { useCurrentUser, usePlans, useEntries } from "@/data/queries";
import { PlanCard } from "./PlanCard";
import { WeekOverview } from "@/features/follow-through/WeekOverview";
export default function PlansScreen() {
  const plans = usePlans();
  const client = useQueryClient();
  const entries = useEntries();
  const user = useCurrentUser();
  const { selectedPlan, view: initialView } = useLocalSearchParams<{
    selectedPlan?: string;
    view?: string;
  }>();
  const [view, setView] = useState(initialView === "week" ? "week" : "plans");
  useEffect(() => {
    if (initialView) setView(initialView);
    if (selectedPlan) setView("plans");
  }, [initialView, selectedPlan]);
  const [selected, setSelected] = useState<string | undefined>(selectedPlan);
  useEffect(() => {
    if (selectedPlan) setSelected(selectedPlan);
  }, [selectedPlan]);
  const [old, setOld] = useState(false);
  const c = useColors();
  const { refresh, refreshing } = useRefresh(
    "plans",
    "follow-through",
    "activity-entries",
    "chats",
    "coach-plans-overview-messages",
  );
  const { width } = useWindowDimensions();
  const columns = width >= 1024 ? 6 : width >= 768 ? 5 : 4;
  const sorted = [...(plans.data ?? [])]
    .filter((p) => !p.deletedAt)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const visible = sorted.filter(
    (p) =>
      old ||
      (!p.archivedAt &&
        (!p.finishingDate || new Date(p.finishingDate) >= new Date())),
  );
  const reorder = useMutation({
    mutationFn: async (next: Plan[]) =>
      api.patch("/plans/bulk-update", {
        updates: next.map((p, sortOrder) => ({
          planId: p.id,
          updates: { sortOrder },
        })),
      }),
    onMutate: async (next) => {
      await client.cancelQueries({ queryKey: ["plans"] });
      const previous = client.getQueryData<Plan[]>(["plans"]);
      client.setQueryData(["plans"], next);
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) client.setQueryData(["plans"], context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["plans"] }),
  });
  const move = ({ id, targetIndex }: PlanOrderChange) => {
    const next = reorderVisiblePlans(sorted, visible, id, targetIndex);
    if (next !== sorted && !reorder.isPending) reorder.mutate(next);
  };
  const tileSize = (Math.min(width, 672) - 32 - (columns - 1) * 12) / columns;
  const plan = sorted.find((p) => p.id === selected) ?? visible[0];
  return (
    <Screen
      testID="plans-screen"
      title="Plans"
      onRefresh={refresh}
      refreshing={refreshing}
    >
      <Status
        loading={plans.isPending}
        error={plans.error}
        retry={() => void plans.refetch()}
      />
      <View
        style={{
          flexDirection: "row",
          backgroundColor: c.soft,
          borderRadius: 24,
          padding: 4,
          gap: 4,
        }}
      >
        {["week", "plans"].map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === tab }}
            onPress={() => setView(tab)}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 22,
              backgroundColor: view === tab ? c.card : "transparent",
            }}
          >
            <Text
              style={{
                color: view === tab ? c.text : c.muted,
                fontWeight: "600",
              }}
            >
              {tab === "week" ? "This week" : "Plans"}
            </Text>
          </Pressable>
        ))}
      </View>
      {view === "week" ? (
        <WeekOverview plans={plans.data ?? []} entries={entries.data ?? []} />
      ) : (
        <>
          <Reveal
            id="plans-selector"
            delay={50}
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
          >
            {visible.map((p, index) => (
              <PlanTile
                key={p.id}
                plan={p}
                index={index}
                count={visible.length}
                columns={columns}
                size={tileSize}
                selected={p.id === plan?.id}
                disabled={reorder.isPending}
                onSelect={() => setSelected(p.id)}
                onMove={(targetIndex) => move({ id: p.id, targetIndex })}
              />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create New Plan"
              onPress={() => router.push("/create-plan")}
              style={{
                width: tileSize,
                aspectRatio: 1,
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: c.border,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 40, color: c.muted }}>＋</Text>
            </Pressable>
          </Reveal>
          <Status error={reorder.error} />
          {sorted.length === 0 && !plans.isPending && (
            <Copy>You haven't created any plans yet.</Copy>
          )}
          {sorted.some(
            (p) =>
              p.archivedAt ||
              (p.finishingDate && new Date(p.finishingDate) < new Date()),
          ) && (
            <Button secondary onPress={() => setOld(!old)}>
              {old ? "Hide old & archived plans" : "Show old & archived plans"}
            </Button>
          )}
          {plan && (
            <PlanCard
              key={plan.id}
              plan={plan}
              entries={entries.data ?? []}
              own
              premium={user.data?.planType !== "FREE"}
              detail
            />
          )}
        </>
      )}
    </Screen>
  );
}
