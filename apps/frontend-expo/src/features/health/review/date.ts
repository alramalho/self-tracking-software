const DAY_MS = 86_400_000;

function calendarDay(value: string | Date): number {
  const date = typeof value === "string" ? new Date(value) : value;
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

export function relativeDateLabel(value: string, now = new Date()): string {
  const difference = calendarDay(now) - calendarDay(value);
  if (difference === 0) return "Today";
  if (difference === 1) return "Yesterday";
  if (difference > 1 && difference <= 6) return `${difference} days ago`;
  if (difference === -1) return "Tomorrow";
  if (difference < -1 && difference >= -6)
    return `In ${Math.abs(difference)} days`;
  return new Date(value).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function workoutDateRelation(
  candidateAt: string,
  workoutAt: string,
): string {
  const difference = calendarDay(candidateAt) - calendarDay(workoutAt);
  if (difference === 0) return "Same day as Watch";
  if (difference === -1) return "1 day before Watch";
  if (difference === 1) return "1 day after Watch";
  return `${Math.abs(difference)} days ${difference < 0 ? "before" : "after"} Watch`;
}

export function timeLabel(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function candidateDateLabel(
  candidateAt: string,
  workoutAt: string,
  now = new Date(),
): string {
  return `${workoutDateRelation(candidateAt, workoutAt)} · ${relativeDateLabel(candidateAt, now)}, ${timeLabel(candidateAt)}`;
}
