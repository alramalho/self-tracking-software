import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import type { CalendarSession } from "@tsw/prisma/follow-through";
import { api } from "@/data/api";
const keyFor = (userId: string) => `trackingso:calendar:${userId}`;
const marker = (userId: string) => `tracking.so calendar sync · ${userId}`;
export async function selectedCalendar(userId: string) {
  return AsyncStorage.getItem(keyFor(userId));
}
export async function chooseCalendar(
  userId: string,
  calendarId: string | null,
) {
  if (calendarId) await AsyncStorage.setItem(keyFor(userId), calendarId);
  else await AsyncStorage.removeItem(keyFor(userId));
}
const running = new Map<string, Promise<void>>();
export function syncCalendar(userId: string) {
  const prior = running.get(userId);
  if (prior) return prior;
  const operation = sync(userId).finally(() => running.delete(userId));
  running.set(userId, operation);
  return operation;
}
async function sync(userId: string) {
  const id = await selectedCalendar(userId);
  if (!id) return;
  const permission = await Calendar.getCalendarPermissions();
  if (!permission.granted)
    throw new Error(
      "Allow Calendar access in Settings to update your sessions.",
    );
  const calendar = await Calendar.ExpoCalendar.get(id);
  if (!calendar.allowsModifications)
    throw new Error(
      "This calendar is no longer writable. Choose another calendar.",
    );
  const sessions = (
    await api.get<CalendarSession[]>("/follow-through/calendar")
  ).data;
  const from = new Date();
  from.setDate(from.getDate() - 7);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setDate(to.getDate() + 42);
  const existing = (await calendar.listEvents(from, to)).filter(
    (event) => event.notes === marker(userId),
  );
  for (const session of sessions.filter(
    (s) => new Date(s.startDate) < to && new Date(s.endDate) >= from,
  )) {
    const event = existing.find((e) => e.url === session.url);
    const data = {
      title: session.title,
      startDate: new Date(session.startDate),
      endDate: new Date(session.endDate),
      allDay: session.allDay,
      timeZone: session.timeZone,
      url: session.url,
      notes: marker(userId),
      alarms: [],
    };
    if (event) await event.update(data);
    else await calendar.createEvent(data);
  }
  // Only events explicitly created by this account's sync can be removed.
  for (const event of existing)
    if (!sessions.some((session) => session.url === event.url))
      await event.delete();
}
