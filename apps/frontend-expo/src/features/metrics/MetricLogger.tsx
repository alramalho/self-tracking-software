import { ChartBar } from "lucide-react-native";
import { LoggingDrawer } from "../activities/logging/LoggingDrawer";
import {
  Entrance,
  FollowUpHeader,
  FollowUpActions,
  CheckInPulse,
} from "@/components/follow-up/Presentation";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Field, Status, useColors } from "@/components/ui";
import { useMetrics } from "@/data/queries";
import { dayKey } from "@/core/dates";
import { api } from "@/data/api";
import type { MetricLoggerProps } from "./types";

const ratingColors = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

export function MetricLogger({ onClose, title }: MetricLoggerProps) {
  const metrics = useMetrics();
  const client = useQueryClient();
  const c = useColors();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  // A partial batch retry only sends unsaved ratings. The backend creates a new row on every POST.
  const saved = useRef(new Set<string>());
  const action = useMutation({
    mutationFn: async () => {
      for (const [metricId, rating] of Object.entries(ratings)) {
        if (saved.current.has(metricId)) continue;
        await api.post("/metrics/entries", {
          metricId,
          rating,
          date: `${dayKey(new Date())}T00:00:00.000Z`,
          description: note.trim() || undefined,
          descriptionSkipped: !note.trim(),
        });
        saved.current.add(metricId);
      }
      if (saved.current.size && note.trim())
        await api.patch("/metrics/entries/today-note", {
          note: note.trim(),
          skip: false,
        });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["metric-entries"] });
      onClose();
    },
  });
  const allRated =
    !!metrics.data?.length &&
    metrics.data.every((metric) => ratings[metric.id] !== undefined);
  function close() {
    if (!action.isPending) action.mutate();
  }
  return (
    <LoggingDrawer contentPadding={40} keyboardToolbar onClose={close}>
      <View testID="metrics-follow-up" style={{ gap: 24 }}>
        <FollowUpHeader
          title={title ?? "Log Your Metrics"}
          icon={
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: c.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChartBar size={32} color="white" />
            </View>
          }
        />
        <Status
          loading={metrics.isPending}
          error={metrics.error}
          retry={() => void metrics.refetch()}
        />
        {metrics.data?.length === 0 && (
          <Copy>
            No metrics configured yet. Add a metric from the Metrics page.
          </Copy>
        )}
        <Entrance delay={400}>
          <View style={{ gap: 12 }}>
            {metrics.data?.map((metric) => (
              <View
                key={metric.id}
                style={{
                  backgroundColor: c.soft,
                  borderColor: c.border,
                  borderWidth: 1,
                  borderRadius: 24,
                  padding: 12,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{metric.emoji}</Text>
                  <Text
                    style={{ fontSize: 14, fontWeight: "500", color: c.muted }}
                  >
                    {metric.title}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      opacity: 0.5,
                    }}
                  >
                    <CheckInPulse />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: c.accent,
                      }}
                    >
                      Missing Check-in
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Pressable
                      key={rating}
                      accessibilityRole="button"
                      accessibilityLabel={`${metric.title} rating ${rating}`}
                      accessibilityState={{
                        selected: ratings[metric.id] === rating,
                        disabled:
                          action.isPending || saved.current.has(metric.id),
                      }}
                      disabled={
                        action.isPending || saved.current.has(metric.id)
                      }
                      onPress={() =>
                        setRatings((previous) => ({
                          ...previous,
                          [metric.id]: rating,
                        }))
                      }
                      style={{
                        flex: 1,
                        aspectRatio: 1,
                        minHeight: 44,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderRadius: 12,
                        borderColor:
                          ratings[metric.id] === rating ? c.text : c.border,
                        backgroundColor:
                          ratings[metric.id] === rating ? c.soft : c.card,
                      }}
                    >
                      <Text
                        style={{
                          fontWeight: "500",
                          fontSize: 16,
                          color:
                            ratings[metric.id] === rating
                              ? c.text
                              : ratingColors[rating - 1],
                        }}
                      >
                        {rating}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </Entrance>
        {allRated && (
          <Entrance>
            <View
              style={{
                paddingTop: 16,
                borderTopWidth: 1,
                borderColor: c.border,
              }}
            >
              <Field
                label="Anything to add?"
                placeholder="Add any additional thoughts or notes about your day..."
                multiline
                value={note}
                onChangeText={setNote}
                editable={!action.isPending}
                style={{ minHeight: 84 }}
              />
            </View>
          </Entrance>
        )}
        <Status error={action.error} />
        <Entrance delay={500}>
          <FollowUpActions
            busy={action.isPending}
            disabled={!Object.keys(ratings).length}
            onDone={close}
            onSkip={close}
          />
        </Entrance>
      </View>
    </LoggingDrawer>
  );
}
