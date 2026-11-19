// Live check of activityTheGoalIsAbout: languages, typos, synonyms and look-alikes.
// Run inside the backend container (it needs the AI gateway key): npx tsx scripts/plan-history/bench.ts
import { activityTheGoalIsAbout } from "../../src/services/plan-design/relevantActivity";
import type { LoggedActivity } from "../../src/services/plan-design/types";

const a = (title: string, emoji: string, measure: string): LoggedActivity => ({ title, emoji, measure, sessionsLast4Weeks: 6, lastLoggedAt: "2026-11-17", baseline: null });
const logged = [
  a("meditate", "🧘", "minutes"), a("Running", "🏃", "km"), a("Gym", "🏋️", "sessions"), a("Reading", "📚", "pages"),
  a("Guitar", "🎸", "minutes"), a("Trail running", "⛰️", "km"), a("Yoga", "🧘‍♀️", "minutes"), a("Spanish", "🇪🇸", "minutes"),
];
const cases: [string, string | null][] = [
  ["meditate every day", "meditate"], ["quero meditar todos os dias", "meditate"], ["meditaton 10 min daily", "meditate"],
  ["méditer chaque matin", "meditate"], ["go runing 3x a week", "Running"], ["laufen 3 mal pro Woche", "Running"],
  ["jogging more often", "Running"], ["finish a 30k trail race in the Alps", "Trail running"], ["read 20 books this year", "Reading"],
  ["ler mais livros", "Reading"], ["bench 80 kg", "Gym"], ["play Wonderwall on the guitarra", "Guitar"],
  ["hablar español con fluidez", "Spanish"], ["learn piano", null], ["aprender chinês", null], ["do pilates twice a week", null],
  ["swim 2 km without stopping", null], ["write a novel", null], ["sleep 8 hours a night", null], ["run my first half marathon", "Running"],
];
(async () => {
  let right = 0;
  for (const [goal, expected] of cases) {
    const t = Date.now();
    const got = (await activityTheGoalIsAbout(goal, logged))?.title ?? null;
    const ok = got === expected;
    if (ok) right++;
    console.log(`${ok ? "ok  " : "MISS"} ${String(Date.now() - t).padStart(5)}ms  ${goal}  →  ${got}${ok ? "" : ` (expected ${expected})`}`);
  }
  console.log(`RESULT ${right}/${cases.length}`);
  process.exit(0);
})();
