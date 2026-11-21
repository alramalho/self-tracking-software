import { prisma } from "../../utils/prisma";
import { ROUGH_EDGE_LABELS, roughEdgesFile, type RoughEdge, type RoughEdgeKind } from "../roughEdges";
import { readJsonlTail } from "./jsonl";
import { DAY_MS } from "./people";
import type { RoughEdges } from "./types";

const WINDOW_DAYS = 7;
const RECENT = 8;

/** Last week's rough edges: a count per kind (only kinds that happened) and the latest few. */
export async function roughEdgesSummary(entries?: RoughEdge[]): Promise<RoughEdges> {
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString();
  const week = (entries ?? (await readJsonlTail<RoughEdge>(roughEdgesFile()))).filter(
    (e) => e.at >= since && e.kind in ROUGH_EDGE_LABELS,
  );
  const counts = new Map<RoughEdgeKind, { count: number; people: Set<string> }>();
  for (const e of week) {
    const c = counts.get(e.kind) ?? { count: 0, people: new Set<string>() };
    c.count++;
    c.people.add(e.userId);
    counts.set(e.kind, c);
  }
  const recent = week.slice(-RECENT).reverse();
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(recent.map((e) => e.userId))] } },
    select: { id: true, username: true },
  });
  const names = new Map(users.map((u) => [u.id, u.username]));
  return {
    days: WINDOW_DAYS,
    kinds: [...counts.entries()]
      .map(([kind, c]) => ({ kind, label: ROUGH_EDGE_LABELS[kind], count: c.count, people: c.people.size }))
      .sort((a, b) => b.count - a.count),
    recent: recent.map((e) => ({
      at: e.at,
      kind: e.kind,
      label: ROUGH_EDGE_LABELS[e.kind],
      username: names.get(e.userId) ?? null,
      detail: e.detail ?? null,
    })),
  };
}
