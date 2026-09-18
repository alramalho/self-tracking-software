const path = require("node:path");
const { createRequire } = require("node:module");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../../..");
const req = createRequire(path.join(root, "apps/backend-node/package.json"));
req("dotenv").config({
  path: path.join(root, "apps/backend-node/.env"),
  quiet: true,
});
process.env.DATABASE_URL =
  "postgresql://alramalho@127.0.0.1:55432/tracking_follow_through_test";
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.NODE_ENV = "test";
process.env.TELEGRAM_BOT_TOKEN = "";
process.env.TELEGRAM_CHAT_IDS = "";
const prefix = `ft-e2e-${Date.now()}`;
const unwrap = (m) => m.default || m;
async function run() {
  const prismaModule = await import("../../src/utils/prisma.ts");
  const prisma =
    prismaModule.prisma || prismaModule.default?.prisma || prismaModule.default;
  const service = unwrap(
    await import("../../src/services/follow-through/service.ts"),
  );
  const onboarding = unwrap(
    await import("../../src/services/follow-through/onboarding/service.ts"),
  );
  const circles = unwrap(
    await import("../../src/services/follow-through/circles/service.ts"),
  );
  const { randomUUID } = require("node:crypto");
  let circleId;
  try {
    const users = await Promise.all(
      Array.from({ length: 14 }, (_, i) =>
        prisma.user.create({
          data: {
            id: `${prefix}-${i}`,
            email: `${prefix}-${i}@example.invalid`,
            planType: i === 0 ? "PLUS" : "FREE",
            timezone: "Europe/Lisbon",
          },
        }),
      ),
    );
    const user = users[0],
      other = users[1];
    const draft = {
      id: randomUUID(),
      goal: "Play guitar consistently",
      emoji: "🎸",
      activityId: null,
      activityTitle: "Guitar",
      measure: "minutes",
      commitment: "TIMED",
      frequency: 3,
      weekdays: [2, 4, 6],
      time: "18:00",
      durationMinutes: 30,
      timezone: "Europe/Lisbon",
      targetDate: null,
      resourceName: "My course",
      resourceUrl: "https://example.com/course",
      nextStep: "Practise my bookmarked exercise",
      format: "TIMER",
      wantsCoaching: true,
      answers: [
        {
          question: "What is difficult?",
          answer: "Finding a time after work",
          use: "Choose a usable slot",
        },
      ],
      step: "finish",
      createdPlanId: null,
    };
    const preferences = {
      coaching: true,
      reminder: false,
      reminderMinutes: 30,
      dayReminderTime: "09:00",
      checkIn: true,
      checkInTime: "10:00",
      weeklyReview: true,
      reviewDay: 0,
      reviewTime: "18:00",
    };
    await assert.rejects(
      () => onboarding.finishOnboarding(other, draft, preferences),
      /not active/,
    );
    const [created, repeated] = await Promise.all([
      onboarding.finishOnboarding(user, draft, preferences),
      onboarding.finishOnboarding(user, draft, preferences),
    ]);
    assert.equal(created.planId, repeated.planId);
    assert.equal(await prisma.plan.count({ where: { userId: user.id } }), 1);
    const saved = await service.snapshot(user);
    const support = saved.state.supports[created.planId];
    assert.equal(support.preferences.checkIn, true);
    assert.ok(Object.keys(saved.state.sessions).length > 1);
    assert.equal(
      (await prisma.user.findUnique({ where: { id: user.id } }))
        .proactiveCoachingEnabled,
      false,
    );
    await assert.rejects(
      () => service.configure(other, support),
      /Plan not found/,
    );
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Europe/Lisbon",
    });
    const session = await service.createSession(
      user,
      created.planId,
      today,
      null,
    );
    await service.timer(user.id, session.id, "START");
    await assert.rejects(
      () => service.timer(other.id, session.id, "START"),
      /no longer available/,
    );
    const second = await service.createSession(
      user,
      created.planId,
      today,
      null,
    );
    await assert.rejects(
      () => service.timer(user.id, second.id, "START"),
      /other timer/,
    );
    await service.timer(user.id, session.id, "FINISH");
    assert.equal(
      (await service.snapshot(user)).state.sessions[session.id].outcome,
      "UNCONFIRMED",
    );
    const entry = await prisma.activityEntry.create({
      data: {
        userId: user.id,
        activityId: session.activityId,
        datetime: new Date(),
        quantity: 15,
        privateNotes: "NEVER EXPOSE THIS",
      },
    });
    await service.outcome(user.id, session.id, "PARTLY", entry.id);
    await assert.rejects(
      () => service.outcome(user.id, second.id, "DONE", entry.id),
      /another session/,
    );
    await service.move(user.id, second.id, today, "19:00");
    const otherPlan = await onboarding.finishOnboarding(
      other,
      { ...draft, id: randomUUID(), wantsCoaching: false },
      { ...preferences, coaching: false, checkIn: false, weeklyReview: false },
    );
    const circle = await circles.createCircle(
      user.id,
      "Guitar circle",
      "Guitar",
      created.planId,
      false,
    );
    circleId = circle.id;
    assert.equal(
      (await circles.circles(other.id, "Guitar")).discover.length,
      0,
    );
    await assert.rejects(
      () => circles.circleDetail(other.id, circle.id),
      /Join this/,
    );
    await assert.rejects(
      () => circles.joinCircle(other.id, otherPlan.planId, circle.id),
      /Circle not found/,
    );
    const detail = await circles.circleDetail(user.id, circle.id);
    await circles.joinCircle(
      other.id,
      otherPlan.planId,
      undefined,
      detail.inviteCode,
    );
    await assert.rejects(
      () => circles.shareLog(other.id, circle.id, entry.id),
      /Choose one/,
    );
    await circles.shareLog(user.id, circle.id, entry.id);
    const shared = await circles.circleDetail(other.id, circle.id);
    assert.equal(shared.posts.length, 1);
    assert.ok(!JSON.stringify(shared).includes("NEVER EXPOSE"));
    const candidates = await Promise.all(
      users
        .slice(2)
        .map(async (person) => ({
          person,
          plan: await onboarding.finishOnboarding(
            person,
            { ...draft, id: randomUUID(), wantsCoaching: false },
            {
              ...preferences,
              coaching: false,
              checkIn: false,
              weeklyReview: false,
            },
          ),
        })),
    );
    const joins = await Promise.allSettled(
      candidates.map(({ person, plan }) =>
        circles.joinCircle(
          person.id,
          plan.planId,
          undefined,
          detail.inviteCode,
        ),
      ),
    );
    assert.equal(
      joins.filter((result) => result.status === "fulfilled").length,
      10,
    );
    assert.equal(
      await prisma.practiceCircleMember.count({
        where: { circleId: circle.id },
      }),
      12,
    );
    await assert.rejects(
      () => service.move(user.id, second.id, "2027-12-01", null),
      /five weeks/,
    );
    const calendar = unwrap(await import("../../src/services/follow-through/calendar.ts"));
  const events = await calendar.calendarSessions(user);
  const booked = events.find(event => event.sessionId === second.id);
  assert.ok(booked && !booked.allDay && booked.url.includes(second.id));
  assert.equal(new Date(booked.endDate) - new Date(booked.startDate), 30 * 60000);
  await service.outcome(user.id, second.id, "SKIPPED");
  assert.ok(!(await calendar.calendarSessions(user)).some(event => event.sessionId === second.id));
  await circles.leaveCircle(user.id, circle.id);
    assert.equal(
      (await circles.circleDetail(other.id, circle.id)).posts.length,
      0,
    );
    assert.equal(
      (await prisma.activityEntry.findUnique({ where: { id: entry.id } }))
        .quantity,
      15,
    );
    await service.configure(user, { ...support, mode: "WEEKLY", weekdays: [], time: null });
    await assert.rejects(() => service.createSession(user, created.planId, today, null), /flexible/);
    assert.equal((await calendar.calendarSessions(user)).length, 0);
    console.log(
      "PASS: real PostgreSQL onboarding idempotency, free/paid gates, ownership, timers, log linking, rescheduling, circle privacy and leave/unshare.",
    );
  } finally {
    if (circleId)
      await prisma.practiceCircle.deleteMany({ where: { id: circleId } });
    await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.$disconnect();
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
