import { prisma } from "../../utils/prisma";
import { DAY_MS, realPeople } from "./people";
import type { Funnel, FunnelPerson, FunnelStepId } from "./types";

// Where people stop in onboarding. There is no step history, only each person's saved onboarding draft
// (coaching_state.data.draft), so a person counts at the furthest point their draft shows.

const STEPS: { id: FunnelStepId; label: string }[] = [
  { id: "signup", label: "Signed up" },
  { id: "goal", label: "Said their goal" },
  { id: "baseline", label: "Said where they start" },
  { id: "motivation", label: "Said why" },
  { id: "rhythm", label: "Picked a rhythm / route" },
  { id: "support", label: "Chose coach or not" },
  { id: "end", label: "Reached plan review + paywall" },
  { id: "finished", label: "Finished onboarding" },
  { id: "logged", label: "Logged an activity" },
  { id: "active", label: "Active in the last 7 days" },
];

const INTERVIEW_STAGES = ["goal", "baseline", "motivation", "rhythm", "support", "review"];
const END_STEPS = ["interview-finish", "confidence"];

type Draft = {
  step?: string;
  awaitingUpgrade?: boolean;
  interview?: { stage?: string };
};

/** Index into STEPS of the furthest step reached before finishing (0 = signed up only). */
export function onboardingReach(draft: Draft | undefined): number {
  if (!draft) return 0;
  if (draft.awaitingUpgrade || END_STEPS.includes(draft.step ?? "")) return STEPS.findIndex((s) => s.id === "end");
  const stage = INTERVIEW_STAGES.indexOf(draft.interview?.stage ?? "goal");
  // Being on stage N means the N stages before it were answered.
  return Math.max(0, stage);
}

export async function onboardingFunnel(days: number, now = new Date()): Promise<Funnel> {
  const since = new Date(now.getTime() - days * DAY_MS);
  const people = await prisma.user.findMany({
    where: { ...realPeople, createdAt: { gte: since } },
    select: {
      id: true,
      username: true,
      createdAt: true,
      lastActiveAt: true,
      onboardingCompletedAt: true,
      planType: true,
      aiConsentGrantedAt: true,
      aiConsentDeclinedAt: true,
      coachingState: { select: { data: true } },
    },
  });
  const ids = people.map((p) => p.id);
  const [loggers, recent] = await Promise.all([
    prisma.activityEntry.groupBy({ by: ["userId"], where: { userId: { in: ids }, deletedAt: null } }),
    prisma.activityEntry.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, deletedAt: null, createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
    }),
  ]);
  const logged = new Set(loggers.map((r) => r.userId));
  const activeWeek = new Set(recent.map((r) => r.userId));

  const finished = STEPS.findIndex((s) => s.id === "finished");
  const reachOf = (person: (typeof people)[number]) => {
    if (!person.onboardingCompletedAt) {
      const data = person.coachingState?.data as { draft?: Draft } | null;
      return onboardingReach(data?.draft);
    }
    let reach = finished;
    if (logged.has(person.id)) reach++;
    else return reach;
    if (activeWeek.has(person.id)) reach++;
    return reach;
  };

  const steps = STEPS.map((step) => ({ ...step, reached: 0, stoppedHere: [] as FunnelPerson[], inProgress: 0 }));
  for (const person of people) {
    const reach = reachOf(person);
    for (let i = 0; i <= reach; i++) steps[i].reached++;
    if (reach === steps.length - 1) continue;
    const lastSeen = person.lastActiveAt ?? person.createdAt;
    if (now.getTime() - lastSeen.getTime() < DAY_MS) steps[reach].inProgress++;
    else
      steps[reach].stoppedHere.push({
        id: person.id,
        username: person.username,
        signedUpAt: person.createdAt.toISOString(),
        lastActiveAt: person.lastActiveAt?.toISOString() ?? null,
      });
  }
  for (const step of steps) step.stoppedHere.sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt));

  const aiConsent = { granted: 0, declined: 0, neverAsked: 0 };
  for (const p of people) {
    if (p.aiConsentGrantedAt && (!p.aiConsentDeclinedAt || p.aiConsentGrantedAt > p.aiConsentDeclinedAt)) aiConsent.granted++;
    else if (p.aiConsentDeclinedAt) aiConsent.declined++;
    else aiConsent.neverAsked++;
  }
  const paying = people.filter((p) => p.planType === "PLUS").length;
  return { days, steps, aiConsent, paying };
}
