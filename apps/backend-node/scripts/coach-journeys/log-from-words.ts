/**
 * "I've been doing it" in Talk to coach: which sessions the coach may put on a "Log it" card straight from
 * their words (talk/logFromWords.ts). Live only, run inside tsw-backend (about $0.03):
 *
 *   TZ=UTC node --import tsx scripts/coach-journeys/log-from-words.ts
 *
 * The rule is the owner's (27 Nov 2026): do more, but never overdo it. A case fails when a card holds a
 * session that isn't in `expect` or `allowed`; a missing expected session only lowers recall (they say it
 * on the voice note instead). "extractor alone" shows what the cards would hold without Jev.
 */
import { sureSessions } from "../../src/services/coach/talk/logFromWords";
import type { VoiceLogActivityContext } from "../../src/services/voice-log/extract";

const NOW = new Date("2026-11-27T20:26:00Z"); // Friday evening
const TZ = "UTC";
type Session = { activityId: string; date: string; quantity: number };

const chinese: VoiceLogActivityContext = {
  activityId: "chinese",
  title: "Chinese practice",
  emoji: "🇨🇳",
  measure: "minutes",
  lastLoggedOn: "2026-11-21",
  loggedDays: [{ date: "2026-11-21", quantity: 90 }],
  plan: { goal: "🇨🇳 Conversational Chinese", timesPerWeek: 5, plannedDays: [] },
};
const gym: VoiceLogActivityContext = {
  activityId: "gym",
  title: "Gym",
  emoji: "💪",
  measure: "sessions",
  lastLoggedOn: "2026-11-20",
  loggedDays: [{ date: "2026-11-20", quantity: 1 }],
  plan: { goal: "💪 train 4 times a week", timesPerWeek: 4, plannedDays: [] },
};
const reading: VoiceLogActivityContext = { ...chinese, activityId: "reading", title: "Reading", emoji: "📚", measure: "pages", plan: null };

const cases: { id: string; source: "real" | "common"; said: string; catalog: VoiceLogActivityContext[]; expect: Session[]; allowed?: Session[] }[] = [
  {
    id: "owner-chinese-almost-daily",
    source: "real",
    said: "I have been doing my Chinese practice almost daily, I mean, today I just did maybe an hour, but on every other day I've been doing like an hour and thirty to two hours actually.",
    catalog: [chinese],
    // Today's hour is plain. "Almost daily" at "an hour and thirty to two hours" names no day and no amount.
    expect: [{ activityId: "chinese", date: "2026-11-27", quantity: 60 }],
  },
  { id: "owner-did-it", source: "real", said: "I've been doing it", catalog: [chinese], expect: [] },
  {
    id: "two-days",
    source: "common",
    said: "Did 45 minutes yesterday and half an hour today, just forgot to log.",
    catalog: [chinese],
    expect: [
      { activityId: "chinese", date: "2026-11-26", quantity: 45 },
      { activityId: "chinese", date: "2026-11-27", quantity: 30 },
    ],
  },
  {
    id: "gym-named-days",
    source: "common",
    said: "Went to the gym Monday and Wednesday, forgot to log both.",
    catalog: [gym],
    expect: [
      { activityId: "gym", date: "2026-11-23", quantity: 1 },
      { activityId: "gym", date: "2026-11-25", quantity: 1 },
    ],
  },
  {
    id: "every-day-since-monday",
    source: "common",
    said: "I've done an hour every day since Monday, I just didn't log it.",
    catalog: [chinese],
    expect: ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"].map((date) => ({ activityId: "chinese", date, quantity: 60 })),
    allowed: [{ activityId: "chinese", date: "2026-11-27", quantity: 60 }],
  },
  { id: "here-and-there", source: "common", said: "I've been reading here and there this week.", catalog: [reading], expect: [] },
  { id: "only-a-plan", source: "common", said: "Not yet, but I'm doing it tomorrow for sure.", catalog: [chinese], expect: [] },
  { id: "a-range-every-day", source: "common", said: "Every day this week I did between one and two hours.", catalog: [chinese], expect: [] },
  {
    id: "a-few-times-no-days",
    source: "common",
    said: "Yeah I did it a few times this week, around an hour each, I just forgot to log.",
    catalog: [chinese],
    expect: [],
  },
  {
    id: "corrects-itself",
    source: "common",
    said: "I did two hours yesterday, no wait, that was Wednesday. Yesterday was only forty minutes.",
    catalog: [chinese],
    expect: [
      { activityId: "chinese", date: "2026-11-25", quantity: 120 },
      { activityId: "chinese", date: "2026-11-26", quantity: 40 },
    ],
  },
  {
    id: "portuguese-yesterday",
    source: "common",
    said: "Fiz uma hora de chinês ontem e esqueci de registar.",
    catalog: [chinese],
    expect: [{ activityId: "chinese", date: "2026-11-26", quantity: 60 }],
  },
];

const key = (s: Session) => `${s.activityId} ${s.date} ${s.quantity}`;

async function main() {
  const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
  let failed = 0;
  let found = 0;
  let wanted = 0;
  let spend = 0;
  let extractorWrong = 0;
  for (const c of cases.filter((x) => !only || only.includes(x.id))) {
    const result = await sureSessions(c.said, NOW, TZ, c.catalog);
    spend += result.costUsd;
    const ok = new Set([...c.expect, ...(c.allowed ?? [])].map(key));
    const wrong = result.kept.filter((s) => !ok.has(key(s)));
    const hits = c.expect.filter((e) => result.kept.some((s) => key(s) === key(e)));
    const alone = result.candidates.filter((a) => a.confidence >= 0.8 && !a.estimatedFrom);
    if (alone.some((s) => !ok.has(key(s)))) extractorWrong++;
    found += hits.length;
    wanted += c.expect.length;
    if (wrong.length) failed++;
    const list = (xs: Session[]) => xs.map((s) => `${s.date.slice(5)}×${s.quantity}`).join(" ") || "nothing";
    console.log(`${wrong.length ? "✗" : "✓"} ${c.id}: card ${list(result.kept)} | wanted ${list(c.expect)} | extractor alone ${list(alone)} | jev ${result.candidates.length ? result.jev.toFixed(2) : "-"}`);
    for (const s of wrong) console.log(`    wrong: ${key(s)}`);
  }
  console.log(`precision: ${cases.length - failed}/${cases.length} cases with no wrong card; recall ${found}/${wanted}; extractor alone would be wrong in ${extractorWrong}; extraction $${spend.toFixed(4)}`);
  if (failed) process.exitCode = 1;
}

main();
