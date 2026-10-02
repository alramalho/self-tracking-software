// Compare models on the scheduled coach's real prompts, using held-out synthetic cases.
// No database, no plan writes, no notifications. Read the replies yourself: schema-valid is not "good".
//
//   COACH_GATEWAY_KEY_FILE=/path/to/file-with-vck-key.md \
//   COACH_MODELS=openai/gpt-6-luna,xiaomi/mimo-v2.6-pro \
//   node --import tsx scripts/coach-monitoring/compare-models.cjs
const fs = require("node:fs");

const keyFile = process.env.COACH_GATEWAY_KEY_FILE;
if (!keyFile) throw new Error("Set COACH_GATEWAY_KEY_FILE to the user-supplied key file");
const key = fs.readFileSync(keyFile, "utf8").match(/`(vck_[^`\s]+)`/)?.[1];
if (!key) throw new Error("No Gateway key found in the supplied file");
process.env.AI_GATEWAY_API_KEY = key;
process.env.BRAINTRUST_API_KEY = "";
process.env.NODE_ENV = "test";

const models = (process.env.COACH_MODELS ||
  "openai/gpt-6-luna,openai/gpt-5.6-luna,xiaomi/mimo-v2.6-pro,deepseek/deepseek-v4.1-flash").split(",");
const reasoning = process.env.COACH_AGENT_REASONING || "low";
const output = process.env.COACH_OUTPUT || "/private/tmp/tracking-coach-model-comparison.json";
const redact = (text) => String(text).replaceAll(key, "[REDACTED]");

// ---- Held-out cases: written for this comparison, never used to tune prompts ----
const DAY = 86400000;
const now = new Date("2026-09-27T18:07:00Z"); // a Sunday, at review time
const daysAgo = (n) => new Date(now.getTime() - n * DAY);

function plan(id, p) {
  return {
    id,
    goal: p.goal,
    goalReason: p.reason ?? null,
    emoji: p.emoji,
    notes: p.notes ?? null,
    coachNotes: JSON.stringify({ baseline: p.baseline }),
    finishingDate: p.weeks ? new Date(now.getTime() + p.weeks * 7 * DAY) : null,
    outlineType: p.sessions ? "SPECIFIC" : "TIMES_PER_WEEK",
    timesPerWeek: p.frequency,
    activities: [{ id: `${id}-activity`, title: p.activity, measure: p.measure }],
    sessions: (p.sessions ?? []).map((s, i) => ({
      id: `${id}-s${i}`,
      activityId: `${id}-activity`,
      date: daysAgo(s.daysAgo),
      quantity: s.quantity,
      descriptiveGuide: s.guide,
    })),
    curriculumFiles: [],
    role: p.role,
    entries: (p.entries ?? []).map((e, i) => ({
      id: `${id}-e${i}`,
      activityId: `${id}-activity`,
      datetime: daysAgo(e.daysAgo),
      quantity: e.quantity,
      difficulty: e.difficulty ?? null,
      privateNotes: e.note ?? null,
    })),
    missed: p.missed ?? [],
  };
}

const cases = [
  {
    id: "hm-setup-some-base",
    look: "Easy + one quality session, each explained; modest volume from 2×5 km",
    kind: "setup",
    plans: [plan("hm", { goal: "Run a half marathon in March", reason: "Prove to myself I can", emoji: "🏃", activity: "Running", measure: "kilometers", frequency: 3, weeks: 24, role: "training",
      baseline: "I run twice a week, about 5 km each at an easy pace, for the last 3 months. Longest run 7 km. Free Mon/Wed/Sat mornings." })],
  },
  {
    id: "gain-80kg-setup",
    look: "Strength week AND asks to track body weight (alsoTrack), says how often",
    kind: "setup",
    plans: [plan("gain", { goal: "Reach 80 kg, mostly muscle", reason: "Feel stronger", emoji: "🏋️", activity: "Gym", measure: "minutes", frequency: 3, weeks: 30, role: "training",
      baseline: "72 kg, 180 cm. Gym twice a week for a year, machines mostly. 60 min sessions. Mon/Wed/Fri free." })],
  },
  {
    id: "lose-weight-setup",
    look: "Walking-based first week, asks to track weight; no diet promises",
    kind: "setup",
    plans: [plan("lose", { goal: "Lose 8 kg before summer", reason: "Knees hurt less", emoji: "🚶", activity: "Walking", measure: "minutes", frequency: 4, weeks: 30, role: "training",
      baseline: "92 kg. Sedentary office job. I can walk 30 minutes without trouble. Evenings free." })],
  },
  {
    id: "run-assumed-missed",
    look: "Treats the unanswered Thursday run as missed; doesn't stack it onto next week",
    kind: "review",
    plans: [plan("run", { goal: "Run a 10k in November", emoji: "🏃", activity: "Running", measure: "kilometers", frequency: 3, weeks: 7, role: "training",
      baseline: "Runs 3×/week, longest 7 km.",
      sessions: [{ daysAgo: 5, quantity: 5, guide: "Easy 5 km." }, { daysAgo: 3, quantity: 6, guide: "5×1 min faster, 2 min easy between." }, { daysAgo: 0, quantity: 8, guide: "Long easy 8 km." }],
      entries: [{ daysAgo: 5, quantity: 5, difficulty: "easy" }, { daysAgo: 0, quantity: 8, difficulty: "medium", note: "Legs fine." }],
      missed: [1] })],
  },
  {
    id: "meditation-lapse",
    look: "Short, a bit blunt, uses THEIR reason (kids/anger); mentions archive option",
    kind: "lapse",
    plans: [plan("med", { goal: "Meditate 3 times a week", reason: "Stop snapping at my kids when I'm stressed", emoji: "🧘", activity: "Meditation", measure: "minutes", frequency: 3, role: "consistency",
      baseline: "Did it daily last year, fell off." })],
  },
  {
    id: "mixed-run-meditation",
    look: "Covers both plans; meditation 1 log = recorded fact, not failure; no forced change",
    kind: "review",
    plans: [
      plan("hm2", { goal: "Half marathon in April", emoji: "🏃", activity: "Running", measure: "kilometers", frequency: 3, weeks: 28, role: "training", baseline: "3×/week easy.",
        sessions: [{ daysAgo: 6, quantity: 5, guide: "Easy 5 km." }, { daysAgo: 4, quantity: 5, guide: "Easy 5 km with 4 strides." }, { daysAgo: 1, quantity: 9, guide: "Long easy 9 km." }],
        entries: [{ daysAgo: 6, quantity: 5, difficulty: "easy" }, { daysAgo: 4, quantity: 5, difficulty: "easy" }, { daysAgo: 1, quantity: 9, difficulty: "medium", note: "Last 2 km tough but fine." }] }),
      plan("med2", { goal: "Meditate 4 times a week", reason: "Calmer at work", emoji: "🧘", activity: "Meditation", measure: "minutes", frequency: 4, role: "consistency", baseline: "Beginner.",
        entries: [{ daysAgo: 3, quantity: 10 }] }),
    ],
  },
  {
    id: "strength-knee-difficulty",
    look: "Responds to the hard note first, lighter/alternative legs, no diagnosis, suggests checking pain",
    kind: "difficulty",
    plans: [plan("str", { goal: "Squat bodyweight by spring", emoji: "🏋️", activity: "Strength", measure: "minutes", frequency: 3, weeks: 20, role: "training", baseline: "Squat 60 kg × 5, bodyweight 75 kg.",
      sessions: [{ daysAgo: 2, quantity: 50, guide: "Squat 5×5 at 62.5 kg, RDL 3×8, rows 3×10." }, { daysAgo: -2, quantity: 50, guide: "Squat 5×5 at 65 kg, press 3×8." }],
      entries: [{ daysAgo: 2, quantity: 45, difficulty: "very_hard", note: "Left knee twinged on the 4th set, stopped. Walking is fine today." }] })],
  },
  {
    id: "lapse-two-habits",
    look: "One message covering both habits, each with its own reason; archive offered",
    kind: "lapse",
    plans: [
      plan("jr", { goal: "Journal 3 times a week", reason: "Understand my moods", emoji: "📓", activity: "Journaling", measure: "entries", frequency: 3, role: "consistency", baseline: "Occasional." }),
      plan("rd", { goal: "Read 20 minutes a day", reason: "Less phone before bed", emoji: "📚", activity: "Reading", measure: "minutes", frequency: 7, role: "consistency", baseline: "Barely read now." }),
    ],
  },
  {
    id: "swim-setup-flexible",
    look: "Two pool sessions on flexible days, no 'which days?' question, modest distances",
    kind: "setup",
    plans: [plan("swim", { goal: "Swim 1.5 km without stopping by spring", reason: "Cross-training for my back", emoji: "🏊", activity: "Swimming", measure: "meters", frequency: 2, weeks: 26, role: "training",
      baseline: "Can swim about 400 m with breaks at the wall. Pool is open every day." })],
  },
  {
    id: "cut-setup-no-days",
    look: "Asks to track weight; home sessions on flexible days; no crash-diet talk",
    kind: "setup",
    plans: [plan("cut", { goal: "Get down to 75 kg", reason: "Play football without getting winded", emoji: "💪", activity: "Home workout", measure: "minutes", frequency: 3, weeks: 20, role: "training",
      baseline: "81 kg, 176 cm. Football once a week, no gym, a pair of 8 kg dumbbells at home." })],
  },
];

const realismCases = [
  { expect: false, goal: "Run a marathon", baseline: "I don't run at all", frequency: 3, weeks: 3 },
  { expect: false, goal: "Lose 20 kg", baseline: "95 kg, sedentary", frequency: 4, weeks: 4 },
  { expect: false, goal: "Get to 80 kg of muscle", baseline: "70 kg, 180 cm, beginner", frequency: 3, weeks: 8 },
  { expect: true, goal: "Run a half marathon", baseline: "I run 2×5 km a week", frequency: 3, weeks: 24 },
  { expect: true, goal: "Reach 80 kg, mostly muscle", baseline: "72 kg, gym twice a week", frequency: 3, weeks: 30 },
  { expect: true, goal: "Meditate 10 minutes 4 times a week", baseline: "Beginner", frequency: 4, weeks: 8 },
];

async function main() {
  const unwrap = (m) => m.default || m;
  const { scheduledCoachSnapshot } = unwrap(await import("../../src/services/coach/monitoring/generation/context.ts"));
  const { generateFromSnapshot } = unwrap(await import("../../src/services/coach/monitoring/generation/service.ts"));
  const { goalLooksRealistic } = unwrap(await import("../../src/services/follow-through/onboarding/interview/guidance.ts"));

  const results = { reasoning, when: new Date().toISOString(), coach: [], realism: [] };
  const save = () => fs.writeFileSync(output, JSON.stringify(results, null, 2), { mode: 0o600 });

  async function runCase(model, c) {
    process.env.SCHEDULED_COACH_MODEL = model;
    process.env.COACH_AGENT_REASONING = reasoning;
    const input = {
      user: { id: "synthetic-comparison", timezone: "UTC", name: "Synthetic" },
      now,
      decision: { id: c.id, kind: c.kind, planIds: c.plans.map((p) => p.id) },
      plans: c.plans,
      supports: Object.fromEntries(c.plans.map((p) => [p.id, { mode: "WEEKLY", weekdays: [], time: null, timezone: "UTC", coaching: { role: p.role } }])),
      entries: c.plans.flatMap((p) => p.entries),
      conversationHistory: [],
      assumedMissedSessionIds: c.plans.flatMap((p) => p.missed.map((i) => `${p.id}-s${i}`)),
    };
    const record = { model, case: c.id, look: c.look };
    const started = Date.now();
    try {
      const snapshot = scheduledCoachSnapshot(input, "");
      const generated = await generateFromSnapshot(input, snapshot);
      record.usage = generated.usage;
      record.reply = generated.draftMessages.map((d) => ({
        content: d.content,
        requiresReply: d.requiresReply,
        proposals: d.planProposals?.map((p) => ({ description: p.description, patch: p.patch })),
      }));
      record.quiet = !!generated.skipped;
    } catch (error) {
      record.error = redact(error.message).slice(0, 500);
    }
    record.seconds = Math.round((Date.now() - started) / 100) / 10;
    console.log(JSON.stringify({ model, case: c.id, seconds: record.seconds, error: record.error }));
    results.coach.push(record);
    save();
  }

  // Models run in parallel; cases within a model run in sequence so latencies stay comparable.
  await Promise.all(models.map(async (model) => {
    for (const c of cases) await runCase(model, c);
  }));

  for (const r of realismCases) {
    const started = Date.now();
    let realistic;
    try {
      realistic = await goalLooksRealistic({
        goal: r.goal, baseline: r.baseline, frequency: r.frequency,
        targetDate: new Date(now.getTime() + r.weeks * 7 * DAY).toISOString().slice(0, 10),
        today: now.toISOString().slice(0, 10),
      });
    } catch (error) {
      realistic = `error: ${redact(error.message).slice(0, 200)}`;
    }
    const record = { ...r, realistic, correct: realistic === r.expect, seconds: (Date.now() - started) / 1000 };
    console.log(JSON.stringify(record));
    results.realism.push(record);
    save();
  }
  console.log(`Saved ${output}`);
}

main().catch((error) => {
  console.error(redact(error.message));
  process.exitCode = 1;
});
