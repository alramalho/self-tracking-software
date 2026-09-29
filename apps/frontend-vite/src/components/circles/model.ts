import type { CircleRecap, MyCircle } from "./types";

// Same wording as the coach's Sunday push: kind about misses, never naming who fell short.
export function recapLine(recap: CircleRecap, streak: number): string {
  const everyone = recap.hit === recap.total;
  const lead = everyone
    ? `All ${recap.total} of you hit your week.`
    : `${recap.hit} of ${recap.total} of you hit your week.`;
  const streakLine =
    everyone && streak >= 2 ? ` That's ${streak} weeks together.` : "";
  const top = recap.topName
    ? ` ${recap.topName} showed up most, ${recap.topCount} times.`
    : "";
  return `${lead}${streakLine}${top}`;
}

// Home square line: "4 of 5 on track · 2 days left", or how far a forming circle is.
export function circleStatusLine(circle: MyCircle): string {
  if (circle.pending) return "Post a photo to join";
  if (circle.status === "FORMING") return `Forming · ${circle.memberCount} of 3`;
  return `${circle.onTrack} of ${circle.memberCount} on track · ${daysLeftLabel(circle.daysLeft)}`;
}

export function daysLeftLabel(days: number): string {
  return days === 1 ? "1 day left" : `${days} days left`;
}

export function firstName(person: { name?: string | null; username?: string | null }) {
  return person.name?.split(" ")[0] || person.username || "Someone";
}

const palette = ["#e0527d", "#d97706", "#8b5cf6", "#0f9f6e", "#3b82f6", "#64748b", "#db2777", "#0891b2"];

// A stable colour per person for avatars without a photo.
export function avatarColor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
