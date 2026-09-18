import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/typography/Text";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { isSameDay } from "date-fns";
import { router } from "expo-router";
import { Panel, useColors } from "@/components/ui";
import { WeekCalendar } from "../../plans/WeekCalendar";
import type { UpcomingSessionsProps } from "./types";

export function UpcomingSessions({ plans, entries }: UpcomingSessionsProps) {
  const [expanded, setExpanded] = useState(false);
  const c = useColors();
  const specific = plans.filter((plan) => plan.outlineType === "SPECIFIC");
  const sessions = specific.flatMap((plan) => plan.sessions ?? []);
  const expiring = sessions.filter(
    (session) =>
      isSameDay(new Date(session.date), new Date()) &&
      !entries.some(
        (entry) =>
          !entry.deletedAt &&
          entry.activityId === session.activityId &&
          isSameDay(new Date(entry.datetime), new Date()),
      ),
  ).length;
  const Chevron = expanded ? ChevronUp : ChevronDown;
  if (!sessions.length) return null;
  return (
    <Panel style={{ borderRadius: 24, padding: 16 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Upcoming sessions"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>
            Upcoming sessions
          </Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            All scheduled plans
          </Text>
        </View>
        {expiring > 0 && (
          <Text
            style={{
              color: "#fbbf24",
              backgroundColor: "#f59e0b26",
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 20,
              fontSize: 12,
            }}
          >
            {expiring} •
          </Text>
        )}
        <Chevron size={20} color={c.muted} />
      </Pressable>
      {expanded && (
        <WeekCalendar
          plans={specific}
          entries={entries}
          rolling
          weekCount={1}
          onLog={(activityId, date) =>
            router.push({
              pathname: "/(tabs)/add",
              params: { activityId, date: date.toISOString() },
            })
          }
        />
      )}
    </Panel>
  );
}
