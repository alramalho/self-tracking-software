import type { CircleRecap, MyCircle } from "./types";

// Same wording as the coach's Sunday push: kind about misses, never naming who fell short.
export function recapLine(recap: CircleRecap, streak: number): string {
  const everyone = recap.hit === recap.total;
  const lead = everyone
    ? `All ${recap.total} of you hit your week.`
    : `${recap.hit} of ${recap.total} of you hit your week.`;
  const streakLine = everyone && streak >= 2 ? ` That's ${streak} weeks together.` : "";
  const top = recap.topName ? ` ${recap.topName} showed up most, ${recap.topCount} times.` : "";
  return `${lead}${streakLine}${top}`;
}

// Home square line: "4 of 5 on track · 2 days left", or how far a forming circle is.
export function circleStatusLine(circle: MyCircle): string {
  if (circle.pending) return "Post a photo to join";
  if (circle.status === "FORMING") return `Forming · ${circle.memberCount} of 3`;
  const days = circle.daysLeft === 1 ? "1 day left" : `${circle.daysLeft} days left`;
  return `${circle.onTrack} of ${circle.memberCount} on track · ${days}`;
}
