import { prisma } from "../../utils/prisma";
import { readJsonlTail } from "./jsonl";
import { DAY_MS, realPeople } from "./people";
import type { CoachCostPart, CoachCosts } from "./types";

/** One line of AI_USAGE_LOG (utils/aiSdk.ts). */
export type UsageLine = {
  at: string;
  kind: string;
  name: string | null;
  model: string | null;
  costUsd: number;
  userId?: string | null;
};

export const COACH_PART_LABELS: Record<CoachCostPart, string> = {
  chat: "Chat replies",
  search: "Web search",
  checkins: "Check-ins",
  talk: "Talk to coach",
};

/** Which part of the coach a usage line paid for, or null when it isn't the coach. */
export function coachPart(line: UsageLine): CoachCostPart | null {
  if (line.name === "coach_web_search") return "search";
  if (line.name === "coach_scheduled") return "checkins";
  if (line.name === "talkTurn") return "talk";
  // Only the chat coach runs as an agent; lines before 24 Nov 2026 have no name.
  if (line.name === "coach" || line.kind.startsWith("agent.")) return "chat";
  return null;
}

export async function coachCosts(days: number, lines?: UsageLine[]): Promise<CoachCosts> {
  const since = new Date(Date.now() - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  const coach = (lines ?? (await readJsonlTail<UsageLine>(process.env.AI_USAGE_LOG ?? null)))
    .map((line) => ({ line, part: coachPart(line) }))
    .filter((x): x is { line: UsageLine; part: CoachCostPart } => x.part !== null && x.line.at.slice(0, 10) >= since);

  const perDay = new Map<string, Record<CoachCostPart, number>>();
  for (let t = Date.parse(`${since}T00:00:00Z`); t <= Date.now(); t += DAY_MS) {
    perDay.set(new Date(t).toISOString().slice(0, 10), { chat: 0, search: 0, checkins: 0, talk: 0 });
  }
  const parts = new Map<CoachCostPart, { usd: number; calls: number }>();
  const models = new Map<string, { usd: number; calls: number }>();
  const people = new Map<string, { usd: number; calls: number }>();
  const add = <K>(map: Map<K, { usd: number; calls: number }>, key: K, usd: number) => {
    const row = map.get(key) ?? { usd: 0, calls: 0 };
    row.usd += usd;
    row.calls++;
    map.set(key, row);
  };
  for (const { line, part } of coach) {
    const usd = Number(line.costUsd) || 0;
    const day = perDay.get(line.at.slice(0, 10));
    if (day) day[part] += usd;
    add(parts, part, usd);
    add(models, line.model ?? "unknown", usd);
    if (line.userId) add(people, line.userId, usd);
  }

  const senders = await coachSenders(new Date(`${since}T00:00:00Z`));
  const users = await prisma.user.findMany({
    where: { id: { in: senders.map((s) => s.userId) } },
    select: { id: true, username: true },
  });
  const names = new Map(users.map((u) => [u.id, u.username]));
  const chat = parts.get("chat");

  return {
    days,
    totalUsd: coach.reduce((sum, { line }) => sum + (Number(line.costUsd) || 0), 0),
    perReplyUsd: chat?.calls ? ((chat.usd + (parts.get("search")?.usd ?? 0)) / chat.calls) : null,
    perDay: [...perDay.entries()].map(([day, usd]) => ({ day, ...usd })),
    parts: (Object.keys(COACH_PART_LABELS) as CoachCostPart[])
      .filter((part) => parts.has(part))
      .map((part) => ({ part, label: COACH_PART_LABELS[part], ...parts.get(part)! })),
    models: [...models.entries()].sort((a, b) => b[1].usd - a[1].usd).map(([model, row]) => ({ model, ...row })),
    people: senders.map((s) => ({
      username: names.get(s.userId) ?? null,
      messages: s.messages,
      talk: s.talk,
      lastAt: s.lastAt,
      usd: people.get(s.userId)?.usd ?? null,
    })),
  };
}

/** Who writes to the coach most: their own messages in the coach chat (Talk to coach answers land there too). */
async function coachSenders(since: Date) {
  const where = { role: "USER" as const, createdAt: { gte: since }, chat: { type: "COACH" as const, user: realPeople } };
  const [all, talk] = await Promise.all([
    prisma.message.groupBy({ by: ["chatId"], where, _count: { _all: true }, _max: { createdAt: true } }),
    prisma.message.groupBy({ by: ["chatId"], where: { ...where, metadata: { path: ["source"], equals: "talk_to_coach" } }, _count: { _all: true } }),
  ]);
  const chats = await prisma.chat.findMany({ where: { id: { in: all.map((g) => g.chatId) } }, select: { id: true, userId: true } });
  const owner = new Map(chats.map((c) => [c.id, c.userId]));
  const talkByChat = new Map(talk.map((g) => [g.chatId, g._count._all]));
  const byUser = new Map<string, { userId: string; messages: number; talk: number; lastAt: string | null }>();
  for (const g of all) {
    const userId = owner.get(g.chatId);
    if (!userId) continue;
    const row = byUser.get(userId) ?? { userId, messages: 0, talk: 0, lastAt: null };
    row.messages += g._count._all;
    row.talk += talkByChat.get(g.chatId) ?? 0;
    const last = g._max.createdAt?.toISOString() ?? null;
    if (last && (!row.lastAt || last > row.lastAt)) row.lastAt = last;
    byUser.set(userId, row);
  }
  return [...byUser.values()].sort((a, b) => b.messages - a.messages).slice(0, 8);
}
