const PENDING_PLAN_GOALS_KEY = "pending_plan_goals";

export interface PendingPlanGoal {
  goal: string;
  emoji: string;
  createdAt: string;
}

export function getPendingPlanGoals(): PendingPlanGoal[] {
  try {
    const stored = localStorage.getItem(PENDING_PLAN_GOALS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function savePendingPlanGoal(plan: { goal: string; emoji: string }): void {
  const existing = getPendingPlanGoals();

  // Avoid duplicates
  const alreadyExists = existing.some(p => p.goal === plan.goal);
  if (alreadyExists) return;

  const newGoal: PendingPlanGoal = {
    ...plan,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(
    PENDING_PLAN_GOALS_KEY,
    JSON.stringify([...existing, newGoal])
  );
}

export function removePendingPlanGoal(goal: string): void {
  const existing = getPendingPlanGoals();
  const filtered = existing.filter(p => p.goal !== goal);
  localStorage.setItem(PENDING_PLAN_GOALS_KEY, JSON.stringify(filtered));
}

export function clearAllPendingPlanGoals(): void {
  localStorage.removeItem(PENDING_PLAN_GOALS_KEY);
}
