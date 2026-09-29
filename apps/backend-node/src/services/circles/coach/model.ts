// What the coach posts in a circle's chat. Wording is fixed (no AI): it names people,
// kindly, so the circle knows who to cheer on.

export interface RecapPerson {
  name: string;
  done: number;
  target: number;
  hit: boolean;
}

export interface BehindPerson {
  name: string;
  toGo: number;
  daysLeft: number;
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

const score = (p: RecapPerson) => `${p.name} ${p.done}/${p.target}`;

// Sunday: who hit their week, who didn't, and what the group can do about it.
export function weekRecapPost(people: RecapPerson[], streak: number): string | null {
  if (people.length < 2) return null;
  const hit = people.filter((p) => p.hit);
  const missed = people.filter((p) => !p.hit);
  const lines = ["Week recap 🏁"];
  if (hit.length) lines.push(`✅ ${hit.map(score).join(" · ")}`);
  if (missed.length) lines.push(`💪 ${missed.map(score).join(" · ")}`);
  if (!missed.length) {
    lines.push(streak >= 2 ? `🔥 Everyone hit their week. That's ${streak} weeks together.` : "🔥 Everyone hit their week.");
    lines.push("Same again this week? 👏");
  } else {
    const names = missed.map((p) => p.name);
    lines.push(
      `${joinNames(names)}, a fresh week starts now. What's one session you'll lock in for Monday?`,
    );
    lines.push(`Everyone, drop ${missed.length === 1 ? names[0] : "them"} a word 👇`);
  }
  return lines.join("\n");
}

// Thursday: only when someone needs a push to make their week.
export function halfwayPost(behind: BehindPerson[]): string | null {
  if (!behind.length) return null;
  const parts = behind.map((p, i) =>
    i === 0
      ? `${p.name} needs ${p.toGo} more in ${p.daysLeft === 1 ? "1 day" : `${p.daysLeft} days`}`
      : `${p.name} ${p.toGo} more`,
  );
  return [
    "Halfway check 👀",
    `${parts.join(", ")}.`,
    `Who's joining ${behind.length === 1 ? behind[0].name : "them"} for a session? Reply here or send a nudge 👋`,
  ].join("\n");
}
