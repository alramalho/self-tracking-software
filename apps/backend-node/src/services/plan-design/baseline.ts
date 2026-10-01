import type { DesignBaseline } from "@tsw/prisma/follow-through";

const DAY = 86_400_000;
export interface LoggedEntry {
  datetime: Date;
  quantity: number;
}

/**
 * Creating a plan in the app is different from onboarding: the person has history. A starting point
 * measured from their own logs beats one they type from memory, and saves a question. Returns null
 * when there is too little to say (under 3 sessions in 4 weeks), so the person describes it themselves.
 */
export function baselineFromLogs(
  entries: LoggedEntry[],
  input: { title: string; measure: string; now: Date },
): DesignBaseline | null {
  const since = input.now.getTime() - 28 * DAY;
  const recent = entries.filter((e) => e.datetime.getTime() >= since && e.quantity > 0);
  if (recent.length < 3) return null;
  const perWeek = Math.round((recent.length / 4) * 10) / 10;
  const total = recent.reduce((n, e) => n + e.quantity, 0);
  const typical = Math.round((total / recent.length) * 10) / 10;
  const longest = Math.max(...recent.map((e) => e.quantity));
  const unit = input.measure;
  const quote = "from your logs, last 4 weeks";
  return {
    text: `${input.title}: ${recent.length} sessions in the last 4 weeks, about ${perWeek} a week. Typically ${typical} ${unit}, longest ${longest} ${unit}.`,
    measurements: [
      { metric: "sessions_per_week", value: perWeek, unit: "per week", sourceQuote: quote },
      { metric: "typical_quantity", value: typical, unit, sourceQuote: quote },
      { metric: "longest_quantity", value: longest, unit, sourceQuote: quote },
    ],
  };
}
