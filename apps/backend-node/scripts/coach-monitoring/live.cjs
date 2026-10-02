// Opt-in experiment using synthetic people and the real model through Vercel Gateway.
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});
if (process.env.COACH_GATEWAY_KEY_FILE) {
  const match = fs
    .readFileSync(process.env.COACH_GATEWAY_KEY_FILE, "utf8")
    .match(/`(vck_[^`\s]+)`/);
  if (!match)
    throw new Error("No gateway key found in the explicitly supplied key file");
  process.env.AI_GATEWAY_API_KEY = match[1];
}
process.env.DATABASE_URL =
  "postgresql://alramalho@127.0.0.1:55432/tracking_follow_through_test";
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.NODE_ENV = "test";
process.env.TELEGRAM_BOT_TOKEN = "";
process.env.TELEGRAM_CHAT_IDS = "";
process.env.BRAINTRUST_API_KEY = "";
const unwrap = (m) => m.default || m;
const prefix = `coach-live-${randomUUID()}`;
async function main() {
  const { prisma } = unwrap(await import("../../src/utils/prisma.ts"));
  const { changeState } = unwrap(
    await import("../../src/services/follow-through/store.ts"),
  );
  const { monitorUser } = unwrap(
    await import("../../src/services/coach/monitoring/service.ts"),
  );
  const { experimental_evaluate: evaluate } = await import("ai");
  const now = new Date();
  const reviewTime = `${String(now.getUTCHours()).padStart(2, "0")}:00`;
  const results = [];
  try {
    for (const scenario of [
      "new-runner",
      "meditation-silence",
      "reported-difficulty",
    ]) {
      const user = await prisma.user.create({
        data: {
          id: `${prefix}-${scenario}`,
          name: "Synthetic test person",
          email: `${prefix}-${scenario}@example.invalid`,
          timezone: "UTC",
          planType: "PLUS",
        },
      });
      const activity = await prisma.activity.create({
        data: {
          userId: user.id,
          title: scenario === "meditation-silence" ? "Meditation" : "Running",
          measure: scenario === "meditation-silence" ? "minutes" : "kilometers",
          emoji: scenario === "meditation-silence" ? "🧘" : "🏃",
        },
      });
      const date = new Date(now.getTime() + 180 * 86400000);
      const plan = await prisma.plan.create({
        data: {
          userId: user.id,
          goal:
            scenario === "meditation-silence"
              ? "Meditate three times a week"
              : "Run my first half marathon under two hours",
          goalReason:
            scenario === "meditation-silence"
              ? "I want to respond more calmly when angry"
              : "Finish alongside my friends",
          timesPerWeek: 3,
          outlineType: "TIMES_PER_WEEK",
          finishingDate: scenario === "meditation-silence" ? null : date,
          coachNotes: JSON.stringify({
            baseline:
              scenario === "new-runner"
                ? ""
                : scenario === "meditation-silence"
                  ? "Returning after a long break"
                  : "Two easy 3 km runs per week, only started one month ago",
            availability: "Tuesday, Thursday and Sunday",
          }),
          activities: { connect: { id: activity.id } },
        },
      });
      await changeState(user.id, async (state) => {
        state.enabled = true;
        state.supports[plan.id] = {
          planId: plan.id,
          mode: "WEEKLY",
          weekdays: [],
          time: null,
          timezone: "UTC",
          durationMinutes: 30,
          format: "LOG",
          resourceName: null,
          resourceUrl: null,
          nextStep: "",
          effectiveDate: now.toISOString().slice(0, 10),
          coaching: {
            role:
              scenario === "meditation-silence" ? "consistency" : "training",
            followUps: true,
            dataAccess: { workouts: false, sleep: false },
          },
          preferences: {
            coaching: true,
            reminder: false,
            reminderMinutes: 30,
            dayReminderTime: "09:00",
            checkIn: false,
            checkInTime: "10:00",
            weeklyReview: scenario === "meditation-silence",
            reviewDay: now.getUTCDay(),
            reviewTime,
          },
        };
        state.monitoring = {
          requests: [],
          reviewed: {},
          consideredEntries: {},
          pausedPlanIds: [],
          setupPlanIds: scenario === "new-runner" ? [plan.id] : [],
        };
      });
      if (scenario === "reported-difficulty")
        await prisma.activityEntry.create({
          data: {
            userId: user.id,
            activityId: activity.id,
            quantity: 3,
            datetime: now,
            difficulty: "hard",
            privateNotes:
              "I had to walk every hill on both runs this week. I can still use the same days. Please make next week more manageable.",
          },
        });
      const start = Date.now();
      const outcome = await monitorUser(user, now);
      const messages = await prisma.message.findMany({
        where: { chat: { userId: user.id } },
        orderBy: { createdAt: "asc" },
      });
      const unchanged = await prisma.plan.findUniqueOrThrow({
        where: { id: plan.id },
        include: { sessions: true },
      });
      const candidate = {
        scenario,
        outcome,
        elapsedMs: Date.now() - start,
        planUnchanged:
          unchanged.timesPerWeek === 3 && unchanged.sessions.length === 0,
        messages: messages.map((m) => ({
          content: m.content,
          metadata: m.metadata,
        })),
      };
      const judged = await evaluate({
        model: "typesafe-ai/jev",
        state: JSON.stringify(candidate),
        questions: {
          grounded: {
            type: "boolean",
            instructions: `Does the response respect the facts in this scenario, without claiming a plan was already changed, inferring missed activity solely from no logs, or guaranteeing the race goal? Scenario facts: ${scenario === "new-runner" ? "No current running baseline is supplied; the user requested a first training plan." : scenario === "meditation-silence" ? "The user wants meditation 3/week for calmer reactions; no meditation logs or missed-session confirmations exist." : "A beginner doing two 3 km runs reports walking on hills, asks for a more manageable week, and keeps the same available days."}`,
          },
          useful: {
            type: "boolean",
            instructions: `Does the response make one useful next step clear, stay brief, and avoid shame or generic encouragement? ${scenario === "new-runner" ? "It should ask for the missing running baseline before prescribing dated sessions." : scenario === "meditation-silence" ? "It may ask whether the person practised without logging or wants help restarting; it must not auto-archive." : "It should acknowledge the specific hill difficulty and suggest or propose a modest adjustment without assuming injury."}`,
          },
        },
        maxRetries: 1,
      });
      candidate.judgment = judged.answers;
      results.push(candidate);
      console.log(
        JSON.stringify({
          scenario,
          outcome,
          elapsedMs: candidate.elapsedMs,
          planUnchanged: candidate.planUnchanged,
          judgment: judged.answers,
        }),
      );
    }
  } finally {
    fs.writeFileSync(
      "/tmp/tracking-coach-live-results.json",
      JSON.stringify(results, null, 2),
    );
    await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
