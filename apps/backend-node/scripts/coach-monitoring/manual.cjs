// Capture the existing scheduler + coach on synthetic snapshots for MANUAL review.
// No automatic judge, reference material, or quality pass score is added here.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
const keyFile = process.env.COACH_GATEWAY_KEY_FILE;
if (!keyFile) throw new Error("Set COACH_GATEWAY_KEY_FILE to the user-supplied key file");
const key = fs.readFileSync(keyFile, "utf8").match(/`(vck_[^`\s]+)`/)?.[1];
if (!key) throw new Error("No Gateway key found in the supplied file");
process.env.AI_GATEWAY_API_KEY = key;
process.env.DATABASE_URL = "postgresql://alramalho@127.0.0.1:55432/tracking_follow_through_test";
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.NODE_ENV = "test";
for (const name of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_IDS", "BRAINTRUST_API_KEY"]) process.env[name] = "";
process.env.SCHEDULED_COACH_MODEL ||= process.env.COACH_AGENT_MODEL || "deepseek/deepseek-v4.1-flash";
process.env.COACH_AGENT_REASONING = process.env.COACH_AGENT_REASONING || "xhigh";
const selected = process.env.COACH_CASES?.split(",");
const snapshots = require("./snapshots.cjs").filter(s => !selected || selected.includes(s.id));
const output = process.env.COACH_OUTPUT || "/tmp/tracking-coach-manual-mimo.json";
const prefix = `coach-manual-${randomUUID()}`;
const unwrap = m => m.default || m;
const safeError = error => ({ name: error.name, message: String(error.message).replaceAll(key, "[REDACTED]") });

async function main() {
  const { prisma } = unwrap(await import("../../src/utils/prisma.ts"));
  const { changeState } = unwrap(await import("../../src/services/follow-through/store.ts"));
  const { scheduledCoachGeneration } = unwrap(await import("../../src/services/coach/monitoring/generation/service.ts"));
  const { monitorUser } = unwrap(await import("../../src/services/coach/monitoring/service.ts"));
  const { readPermittedCoachContext } = unwrap(await import("../../src/services/coach/monitoring/context.ts"));
  const generated = new Map();
  const generationErrors = new Map();
  const originalGenerate = scheduledCoachGeneration.generate.bind(scheduledCoachGeneration);
  scheduledCoachGeneration.generate = async params => {
    try {
      const response = await originalGenerate(params);
      generated.set(params.user.id, { generatorInput: { kind: params.decision.kind, planIds: params.decision.planIds }, response });
      return response;
    } catch (error) {
      generationErrors.set(params.user.id, safeError(error));
      throw error;
    }
  };
  const run = { startedAt: new Date().toISOString(), model: process.env.SCHEDULED_COACH_MODEL, reasoning: process.env.COACH_AGENT_REASONING, evaluation: "manual, unscored", results: [] };
  const save = () => fs.writeFileSync(output, JSON.stringify(run, null, 2), { mode: 0o600 });
  try {
    for (const snapshot of snapshots) {
      const now = new Date();
      const pastWeekday = weekday => {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() - weekday + 7) % 7 || 7));
        date.setUTCHours(18, 0, 0, 0);
        return date;
      };
      const user = await prisma.user.create({ data: { id: `${prefix}-${snapshot.id}`, email: `${prefix}-${snapshot.id}@example.invalid`, name: "Synthetic reviewer", age: snapshot.age === null ? null : 28, timezone: "UTC", planType: "PLUS", createdAt: new Date(now.getTime() - 35 * 86400000) } });
      const plans = [];
      for (const source of snapshot.plans) {
        const activity = await prisma.activity.create({ data: { userId: user.id, title: source.activity, emoji: source.emoji, measure: source.measure } });
        const plan = await prisma.plan.create({ data: { userId: user.id, goal: source.goal, goalReason: source.reason, timesPerWeek: source.frequency, outlineType: source.scheduled ? "SPECIFIC" : "TIMES_PER_WEEK", finishingDate: source.targetDays ? new Date(now.getTime() + source.targetDays * 86400000) : null, notes: `Where are you now?\n${source.baseline}\n\n${source.notes || ""}`, coachNotes: JSON.stringify({ baseline: source.baseline }), createdAt: new Date(now.getTime() - 28 * 86400000), activities: { connect: { id: activity.id } } } });
        plans.push({ source, plan, activity });
        for (const session of source.sessions || []) await prisma.planSession.create({ data: { planId: plan.id, activityId: activity.id, date: pastWeekday(session.weekday), quantity: session.quantity, descriptiveGuide: session.guide } });
        for (const entry of source.entries || []) await prisma.activityEntry.create({ data: { userId: user.id, activityId: activity.id, quantity: entry.quantity, datetime: pastWeekday(entry.weekday), difficulty: entry.difficulty, privateNotes: entry.note } });
        for (const workout of source.workouts || []) {
          const startAt = pastWeekday(workout.weekday);
          await prisma.healthWorkout.create({ data: { userId: user.id, externalId: randomUUID(), activityTypeCode: 37, activityTypeName: "running", startAt, endAt: new Date(startAt.getTime() + workout.seconds * 1000), durationSeconds: workout.seconds, distanceMeters: workout.distance, sourceName: "Apple Watch", sourceBundleId: "com.apple.health", metadata: { averageHeartRateBpm: workout.heartRate, workoutEffortScore: workout.effort } } });
        }
        for (const [index, hours] of (source.sleep || []).entries()) await prisma.healthDailyMetric.create({ data: { userId: user.id, localDate: new Date(now.getTime() - (index + 1) * 86400000).toISOString().slice(0, 10), metric: "sleep_asleep", aggregation: "sum", value: hours * 3600, unit: "seconds" } });
        if (source.access) await prisma.healthIntegration.create({ data: { userId: user.id, deviceId: randomUUID(), lastSyncCompletedAt: new Date(now.getTime() - 3600000), requestedDataTypes: ["workouts", "sleep"] } });
      }
      await changeState(user.id, async state => {
        state.enabled = true;
        state.monitoring = { requests: [], reviewed: {}, consideredEntries: {}, pausedPlanIds: [], setupPlanIds: snapshot.trigger === "setup" ? plans.map(p => p.plan.id) : [] };
        for (const { source, plan } of plans) state.supports[plan.id] = {
          planId: plan.id, mode: "WEEKLY", weekdays: [], time: null, timezone: "UTC", durationMinutes: 30, format: "LOG", resourceName: null, resourceUrl: null, nextStep: "", effectiveDate: now.toISOString().slice(0,10),
          coaching: { role: source.role || "training", followUps: true, dataAccess: { workouts: !!source.access, sleep: !!source.access } },
          preferences: { coaching: true, reminder: false, reminderMinutes: 30, dayReminderTime: "09:00", checkIn: false, checkInTime: "10:00", weeklyReview: snapshot.trigger === "review", reviewDay: now.getUTCDay(), reviewTime: `${String(now.getUTCHours()).padStart(2, "0")}:00` },
        };
      });
      const getPlans = () => prisma.plan.findMany({ where: { userId: user.id }, include: { activities: true, sessions: true } });
      const before = await getPlans();
      const record = { id: snapshot.id, title: snapshot.title, now: now.toISOString(), snapshot, persistedInput: { plans: before, entries: await prisma.activityEntry.findMany({ where: { userId: user.id } }), healthContext: await readPermittedCoachContext(user.id, plans.map(p => p.plan.id)) } };
      run.results.push(record);
      save();
      console.log(JSON.stringify({ event: "start", id: snapshot.id, model: run.model, reasoning: run.reasoning }));
      const start = Date.now();
      try { record.outcome = await monitorUser(user, now); } catch (error) { record.error = safeError(error); }
      record.elapsedMs = Date.now() - start;
      record.generation = generated.get(user.id);
      record.generationError = generationErrors.get(user.id);
      record.messages = await prisma.message.findMany({ where: { chat: { userId: user.id } }, orderBy: { createdAt: "asc" }, select: { content: true, metadata: true, planId: true } });
      record.planUnchanged = JSON.stringify(before) === JSON.stringify(await getPlans());
      record.notificationCount = await prisma.notification.count({ where: { userId: user.id } });
      save();
      console.log(JSON.stringify({ event: "finish", id: snapshot.id, outcome: record.outcome, elapsedMs: record.elapsedMs, planUnchanged: record.planUnchanged, messageCount: record.messages.length, error: record.error, telemetry: record.generation?.response.telemetry }));
    }
  } finally {
    run.finishedAt = new Date().toISOString(); save();
    await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(JSON.stringify(safeError(error))); process.exitCode = 1; });
