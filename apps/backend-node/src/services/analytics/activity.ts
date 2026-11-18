import { prisma } from "../../utils/prisma";
import { DAY_MS, dayKey, realPeople } from "./people";
import type { DayStats, TopUser } from "./types";

// Active = logged an activity, did a check-in, or wrote to the coach that UTC day.
// Weekly and monthly actives are unions of the daily sets, so they are exact.

export async function activeDays(since: Date) {
  const person = { user: realPeople };
  const [logs, checkIns, messages] = await Promise.all([
    prisma.activityEntry.findMany({ where: { createdAt: { gte: since }, deletedAt: null, ...person }, select: { userId: true, createdAt: true } }),
    prisma.metricEntry.findMany({ where: { createdAt: { gte: since }, ...person }, select: { userId: true, createdAt: true } }),
    prisma.message.findMany({
      where: { createdAt: { gte: since }, role: "USER", senderId: { not: null }, sender: realPeople },
      select: { senderId: true, createdAt: true },
    }),
  ]);
  const byDay = new Map<string, Set<string>>();
  const add = (userId: string, at: Date) => {
    const day = dayKey(at);
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day)!.add(userId);
  };
  logs.forEach((l) => add(l.userId, l.createdAt));
  checkIns.forEach((c) => add(c.userId, c.createdAt));
  messages.forEach((m) => add(m.senderId!, m.createdAt));
  return { byDay, logs };
}

export async function dailySeries(
  days: number,
  voicePerDay: Map<string, { kept: number; dropped: number }>,
  now = new Date(),
): Promise<DayStats[]> {
  // 29 extra days so the first bars' monthly actives are complete.
  const since = new Date(now.getTime() - (days - 1 + 29) * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);
  const [{ byDay, logs }, signups] = await Promise.all([
    activeDays(since),
    prisma.user.findMany({ where: { ...realPeople, createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);
  const count = (items: { createdAt: Date }[]) => {
    const out = new Map<string, number>();
    for (const item of items) out.set(dayKey(item.createdAt), (out.get(dayKey(item.createdAt)) ?? 0) + 1);
    return out;
  };
  const logsPerDay = count(logs);
  const signupsPerDay = count(signups);
  const distinct = (end: number, window: number) => {
    const ids = new Set<string>();
    for (let i = 0; i < window; i++) for (const id of byDay.get(dayKey(new Date(end - i * DAY_MS))) ?? []) ids.add(id);
    return ids.size;
  };
  const series: DayStats[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ms = now.getTime() - i * DAY_MS;
    const day = dayKey(new Date(ms));
    series.push({
      day,
      dau: distinct(ms, 1),
      wau: distinct(ms, 7),
      mau: distinct(ms, 30),
      signups: signupsPerDay.get(day) ?? 0,
      logs: logsPerDay.get(day) ?? 0,
      voice: voicePerDay.get(day) ?? { kept: 0, dropped: 0 },
    });
  }
  return series;
}

/** Most active people over the last 30 days, by active days then logs. */
export async function topUsers(voiceNotesByUser: Map<string, number>, now = new Date()): Promise<TopUser[]> {
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const { byDay, logs } = await activeDays(since);
  const days = new Map<string, number>();
  for (const ids of byDay.values()) for (const id of ids) days.set(id, (days.get(id) ?? 0) + 1);
  const logCount = new Map<string, number>();
  for (const l of logs) logCount.set(l.userId, (logCount.get(l.userId) ?? 0) + 1);
  const ranked = [...days.entries()]
    .sort((a, b) => b[1] - a[1] || (logCount.get(b[0]) ?? 0) - (logCount.get(a[0]) ?? 0))
    .slice(0, 25);
  const users = await prisma.user.findMany({
    where: { id: { in: ranked.map(([id]) => id) } },
    select: { id: true, username: true, planType: true, createdAt: true, lastActiveAt: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return ranked.flatMap(([id, activeDayCount]) => {
    const user = byId.get(id);
    if (!user) return [];
    return [{
      id,
      username: user.username,
      activeDays: activeDayCount,
      logs: logCount.get(id) ?? 0,
      voiceNotes: voiceNotesByUser.get(id) ?? 0,
      plan: user.planType,
      signedUpAt: user.createdAt.toISOString(),
      lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    }];
  });
}
