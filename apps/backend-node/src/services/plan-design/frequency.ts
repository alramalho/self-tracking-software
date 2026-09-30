import type { RouteId } from "@tsw/prisma/follow-through";

/**
 * "How many days can you train?" is asked before the two routes exist. It is a limit, not a
 * target: Oli uses every day you offer, Helly keeps room to recover. When you can only train
 * once or twice a week there is no room to trade, so both routes keep your days and differ in
 * how much each session asks and how long the road is.
 */
export function routeDays(available: number): Record<RouteId, number> {
  const days = Math.max(1, Math.min(7, Math.round(available)));
  const steady = days >= 7 ? 5 : days >= 4 ? days - 1 : days;
  return { steady, focused: days };
}

export const routeCoach = { steady: "Helly", focused: "Oli" } as const;
