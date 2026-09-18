import { useMemo, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { buildPlanWeekProjection } from "@tsw/prisma/plan-week";
import { addDays, format, startOfDay, startOfWeek } from "date-fns";
import { dayKey } from "@/core/dates";
import { Button, Copy, Sheet, s, useColors } from "@/components/ui";
import { X } from "lucide-react-native";
import type {
  WeekCalendarProps,
  WeekCalendarSelection,
} from "./types";
export function WeekCalendar({
  plans,
  entries,
  onLog,
  rolling = false,
  weekCount = 2,
  selectionDisplay = "sheet",
}: WeekCalendarProps) {
  const c = useColors();
  const [selected, setSelected] = useState<WeekCalendarSelection>();
  const now = new Date();
  const projection = useMemo(
    () =>
      buildPlanWeekProjection({
        plans: plans.filter(
          (p) =>
            !p.archivedAt &&
            !p.deletedAt &&
            !p.isPaused &&
            (!p.finishingDate || new Date(p.finishingDate) > new Date()),
        ),
        entries: entries.filter((e) => !e.deletedAt),
        now: new Date(),
        weekCount: 2,
      }),
    [plans, entries],
  );
  const selectedActivity = selected
    ? projection.activities.find(
        (activity) =>
          activity.id ===
          (selected.kind === "scheduled"
            ? selected.session.activityId
            : selected.cell.activityId),
      )
    : undefined;
  const selectedDate = selected
    ? selected.kind === "scheduled"
      ? selected.session.date
      : selected.cell.date
    : undefined;
  const selectedDateKey = selectedDate ? dayKey(selectedDate) : undefined;
  return (
    <>
      <View testID="plan-week-calendar" style={{ gap: 16 }}>
        {Array.from({ length: weekCount }, (_, week) => (
          <View key={week} style={{ gap: 8 }}>
            <Copy muted>
              {rolling
                ? week === 0
                  ? "Next 7 days"
                  : "Following 7 days"
                : week === 0
                  ? "This week"
                  : "Next week"}
            </Copy>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {Array.from({ length: 7 }, (_, day) => {
                const date = addDays(
                  rolling ? startOfDay(now) : startOfWeek(now),
                  week * 7 + day,
                );
                const key = dayKey(date);
                const scheduled = projection.scheduledSessions.filter(
                  (s) => s.dateKey === key,
                );
                const flexible = projection.flexibleCells.filter(
                  (s) => s.dateKey === key,
                );
                const completed = projection.completedCells.filter(
                  (s) => s.dateKey === key,
                );
                return (
                  <View
                    key={key}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 82,
                      gap: 6,
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 2,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor:
                        key === selectedDateKey
                          ? c.selectedBorder
                          : key === dayKey(now)
                            ? `${c.accent}55`
                            : c.border,
                      backgroundColor:
                        key === selectedDateKey ? c.selectedBg : c.card,
                      opacity:
                        date <
                        new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          now.getDate(),
                        )
                          ? 0.55
                          : 1,
                    }}
                  >
                    <Text
                      style={{
                        color: key === dayKey(now) ? c.accent : c.muted,
                        fontSize: 10,
                      }}
                    >
                      {format(date, "EEE").toUpperCase()}
                    </Text>
                    <Text
                      style={{
                        color: key === dayKey(now) ? c.accent : c.text,
                        fontWeight: "700",
                        fontSize: 14,
                      }}
                    >
                      {format(date, "d")}
                    </Text>
                    {completed.map((s, i) => (
                      <View
                        key={`done-${i}`}
                        style={{
                          backgroundColor: c.dark ? "#14532d" : "#dcfce7",
                          borderRadius: 6,
                          padding: 4,
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>{s.emoji || "✓"}</Text>
                        <Text
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -3,
                            color: "#22c55e",
                            fontWeight: "700",
                          }}
                        >
                          ✓
                        </Text>
                      </View>
                    ))}
                    {scheduled.map((session, i) => (
                      <Pressable
                        key={`session-${i}`}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${projection.activities.find((a) => a.id === session.activityId)?.title} on ${key}`}
                        onPress={() =>
                          setSelected({ kind: "scheduled", session })
                        }
                      >
                        <Copy>
                          {projection.activities.find(
                            (a) => a.id === session.activityId,
                          )?.emoji || "○"}{" "}
                          {session.quantity ?? ""}
                        </Copy>
                      </Pressable>
                    ))}
                    {flexible.map((cell, i) => (
                      <Pressable
                        key={`flex-${i}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${cell.kind === "overflow" ? "Overdue" : "Planned"} ${cell.title} on ${key}`}
                        onPress={() =>
                          setSelected({
                            kind: "flexible",
                            cell,
                            planTitle:
                              plans.find((p) => p.id === cell.planId)?.goal ??
                              "",
                          })
                        }
                        style={{
                          borderWidth: 1,
                          borderStyle: "dashed",
                          borderColor:
                            cell.kind === "overflow" ? "#ef4444" : c.muted,
                          borderRadius: 6,
                          padding: 4,
                        }}
                      >
                        <Copy>{cell.emoji || "○"}</Copy>
                      </Pressable>
                    ))}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
      {selectionDisplay === "card" ? (
        selected && selectedActivity && selectedDate ? (
          <View
            testID={
              selected.kind === "flexible"
                ? "selected-flexible-slot"
                : "selected-planned-session"
            }
            style={{
              borderWidth: 1,
              borderColor: c.selectedBorder,
              borderRadius: 12,
              padding: 16,
              gap: 12,
              backgroundColor: c.fadedBg,
            }}
          >
            <View
              style={[s.row, { alignItems: "flex-start", justifyContent: "space-between" }]}
            >
              <View style={[s.row, { alignItems: "flex-start", flex: 1 }]}>
                <Text style={{ fontSize: 24 }}>
                  {selected.kind === "flexible"
                    ? selected.cell.emoji || "○"
                    : selectedActivity.emoji || "📋"}
                </Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{ color: c.text, fontWeight: "700", fontSize: 16 }}
                  >
                    {selected.kind === "flexible"
                      ? "Flexible weekly slot"
                      : selectedActivity.title}
                  </Text>
                  <Copy muted>{format(selectedDate, "EEEE, MMM d")}</Copy>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close planned activity"
                onPress={() => setSelected(undefined)}
                hitSlop={8}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={20} color={c.muted} />
              </Pressable>
            </View>
            {selected.kind === "flexible" ? (
              <Copy>
                {selected.planTitle || "This plan"} has a weekly target rather
                than fixed days. This marker is a suggested open day for one
                of your remaining weekly sessions. Log any activity from this
                plan whenever it works.
              </Copy>
            ) : (
              <>
                {!!selected.session.descriptiveGuide && (
                  <Copy>{selected.session.descriptiveGuide}</Copy>
                )}
                {!!selected.session.planTitle && (
                  <Copy muted>Part of {selected.session.planTitle} plan</Copy>
                )}
              </>
            )}
            {selected.kind === "flexible" && selected.cell.kind === "overflow" && (
              <Copy muted>
                ⚠️ More sessions remain than days left this week — some won't
                fit unless you double up.
              </Copy>
            )}
          </View>
        ) : null
      ) : (
        <Sheet
          visible={!!selected}
          title="Planned activity"
          onClose={() => setSelected(undefined)}
        >
          {selected && selectedActivity && selectedDate && (
            <>
              <Copy>
                {selectedActivity.title}{" "}
                · {format(selectedDate, "EEE, MMM d")}
              </Copy>
              {selected.kind === "scheduled" && !!selected.session.quantity && (
                <Copy>
                  {selected.session.quantity}{" "}
                  {selectedActivity.measure}
                </Copy>
              )}
              {selected.kind === "scheduled" &&
                !!selected.session.descriptiveGuide && (
                  <Copy>{selected.session.descriptiveGuide}</Copy>
                )}
              {selected.kind === "scheduled" &&
                selected.session.imageUrls?.map((uri) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={{ width: "100%", height: 220, borderRadius: 12 }}
                    resizeMode="contain"
                  />
                ))}
              {onLog && (
                <Button
                  onPress={() => {
                    const logDate =
                      selectedDate > new Date() ? new Date() : selectedDate;
                    onLog(selectedActivity.id, logDate);
                    setSelected(undefined);
                  }}
                >
                  {selectedDate > new Date() ? "Log now" : "Log Activity"}
                </Button>
              )}
            </>
          )}
        </Sheet>
      )}
    </>
  );
}
