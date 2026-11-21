import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/data/api";
import type { Plan } from "@/core/types";
import type { Milestone } from "./model";

/**
 * Habit and Lifestyle badges: the log moment plays them when it can tell, and anything it couldn't (a log from
 * the watch, the web or another phone, a dated plan) is shown once on opening the app. The server keeps
 * achievedAt / celebratedAt per badge; a local note covers the gap until the server has caught up.
 */
const SEEN_KEY = "celebrated-milestones";
/** Only badges earned this recently are recapped, so nobody gets a pile of old ones the first time. */
const RECAP_DAYS = 14;

type Badge = { achievedAt?: string | null; celebratedAt?: string | null; isAchieved?: boolean };

async function seenNotes(): Promise<Record<string, string>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) ?? "{}");
  } catch {
    return {};
  }
}

/** Remembers that this plan's badge was shown (here and on the server). Never throws. */
export async function markMilestoneCelebrated(planId: string, kind: Milestone) {
  try {
    const notes = await seenNotes();
    notes[`${planId}:${kind}`] = new Date().toISOString();
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(notes));
  } catch {}
  await api.post(`/plans/${planId}/milestone-celebrated`, { kind }).catch(() => {});
}

/** The newest badge earned recently and not shown yet, if any. Lifestyle wins over Habit. */
export function unseenMilestone(
  plans: Plan[],
  notes: Record<string, string>,
  now = new Date(),
): { plan: Plan; kind: Milestone } | null {
  const since = now.getTime() - RECAP_DAYS * 86400000;
  const unseen = (plan: Plan, kind: Milestone, badge: Badge | undefined) => {
    const at = badge?.achievedAt ? new Date(badge.achievedAt).getTime() : NaN;
    if (!(at >= since) || at > now.getTime() + 60000) return null;
    const shown = [badge?.celebratedAt, notes[`${plan.id}:${kind}`]]
      .map((d) => (d ? new Date(d).getTime() : 0))
      .some((t) => t >= at - 10 * 60000);
    return shown ? null : { plan, kind, at };
  };
  const found = plans
    .filter((p) => !p.deletedAt && !p.archivedAt)
    .flatMap((plan) => {
      const progress = plan.progress as { habitAchievement?: Badge; lifestyleAchievement?: Badge } | undefined;
      const lifestyle = progress?.lifestyleAchievement;
      const habit = progress?.habitAchievement;
      return [
        lifestyle?.isAchieved !== false ? unseen(plan, "lifestyle", lifestyle) : null,
        // Dropping back from Lifestyle re-earns Habit on the server: that's no moment to celebrate.
        habit?.isAchieved !== false && !lifestyle?.achievedAt ? unseen(plan, "habit", habit) : null,
      ];
    })
    .filter((x): x is { plan: Plan; kind: Milestone; at: number } => !!x)
    .sort((a, b) => (a.kind === b.kind ? b.at - a.at : a.kind === "lifestyle" ? -1 : 1));
  return found[0] ? { plan: found[0].plan, kind: found[0].kind } : null;
}

export async function findUnseenMilestone(plans: Plan[]) {
  return unseenMilestone(plans, await seenNotes());
}
