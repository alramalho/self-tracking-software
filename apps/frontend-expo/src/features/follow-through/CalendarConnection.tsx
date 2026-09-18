import { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import * as Calendar from "expo-calendar";
import { useMutation } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react-native";
import { useSession } from "@/auth/provider";
import { Button, Copy, IconButton, Status } from "@/components/ui";
import { LoggingDrawer } from "@/features/activities/logging/LoggingDrawer";
import {
  chooseCalendar,
  selectedCalendar,
  syncCalendar,
} from "@/native/calendar-sync";
import { useFollowThrough } from "./api";
import { router } from "expo-router";
import type { CalendarConnectionProps } from "./types";
export function CalendarConnection({
  asMenu = false,
}: CalendarConnectionProps) {
  const auth = useSession(),
    query = useFollowThrough();
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<Calendar.ExpoCalendar[]>([]);
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    if (auth.userId && Platform.OS !== "web")
      void selectedCalendar(auth.userId).then(setSelected).catch(setError);
  }, [auth.userId]);
  useEffect(() => {
    if (selected && auth.userId && query.data)
      void syncCalendar(auth.userId).catch(setError);
  }, [query.dataUpdatedAt, selected, auth.userId]);
  const load = useMutation({
    mutationFn: async () => {
      const permission = await Calendar.requestCalendarPermissions();
      if (!permission.granted)
        throw new Error(
          "Calendar access was not granted. Your plan still works without it.",
        );
      setCalendars(
        (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).filter(
          (calendar) => calendar.allowsModifications,
        ),
      );
    },
  });
  const connect = useMutation({
    mutationFn: async (id: string | null) => {
      if (!auth.userId) return;
      await chooseCalendar(auth.userId, id);
      setSelected(id);
      setError(undefined);
      if (id) await syncCalendar(auth.userId);
    },
  });
  if (Platform.OS === "web") return null;
  return (
    <>
      {asMenu ? (
        <IconButton
          label="Week options"
          icon={MoreHorizontal}
          onPress={() => setOpen(true)}
        />
      ) : (
        <Button secondary onPress={() => setOpen(true)}>
          {selected ? "Calendar connected" : "Add to my calendar"}
        </Button>
      )}
      {open && (
        <LoggingDrawer
          title={asMenu ? "Week options" : "Your calendar"}
          testID="calendar-connection"
          dismissLabel="Dismiss calendar settings"
          onClose={() => setOpen(false)}
        >
          <Copy>
            Keep upcoming sessions in a calendar you choose. Timed sessions get
            a time; day-only sessions become all-day events. Flexible weekly
            goals stay off the calendar.
          </Copy>
          <Copy muted>
            Choose a Google calendar if your Google account is connected in
            iPhone Settings → Apps → Calendar → Calendar Accounts. This sync
            runs when you open your week here. Calendar edits do not change your
            plan.
          </Copy>
          <Button busy={load.isPending} onPress={() => load.mutate()}>
            Choose calendar
          </Button>
          {calendars.map((calendar) => (
            <Button
              key={calendar.id}
              secondary={selected !== calendar.id}
              busy={connect.isPending}
              onPress={() => connect.mutate(calendar.id)}
            >{`${calendar.title} · ${calendar.source?.name || "On this device"}`}</Button>
          ))}
          {selected && (
            <>
              <Button
                busy={connect.isPending}
                onPress={() => connect.mutate(selected)}
              >
                Sync now
              </Button>
              <Button
                secondary
                busy={connect.isPending}
                onPress={() => connect.mutate(null)}
              >
                Disconnect calendar
              </Button>
              <Copy muted>
                Disconnecting stops updates. Existing calendar events remain.
              </Copy>
            </>
          )}
          {asMenu && (
            <Button
              secondary
              onPress={() => {
                setOpen(false);
                router.push("/circles" as never);
              }}
            >
              Circles
            </Button>
          )}
          <Status error={error ?? load.error ?? connect.error} />
        </LoggingDrawer>
      )}
    </>
  );
}
