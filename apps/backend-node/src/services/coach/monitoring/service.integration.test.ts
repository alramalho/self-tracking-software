import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type {
  PlanSupport,
  FollowThroughState,
} from "@tsw/prisma/follow-through";
import type { User } from "@tsw/prisma";
import { prisma } from "../../../utils/prisma";
import { initialState } from "../../follow-through/model";
import { changeState } from "../../follow-through/store";
import { monitorUser } from "./service";
import { monitoringState } from "./model";
import { permittedCoachContext, permittedCoachHistory } from "./context";
import { recordCoachRequests, resolveCoachConversation } from "./requests";
import { toCoachConversationHistory } from "../../coachConversationHistoryService";
import { executePlanProposalPatch } from "../../planProposalPatchService";
import { StaleCoachProposalError, planProposalBasis } from "./proposal-basis";

const external = vi.hoisted(() => ({ generate: vi.fn(), push: vi.fn() }));
vi.mock("./generation/service", () => ({
  scheduledCoachGeneration: { generate: external.generate },
}));
vi.mock("../../notificationService", () => ({
  notificationService: { sendPushNotification: external.push },
}));

// Fail closed: these tests create and delete only synthetic users in the isolated local database.
const database = new URL(process.env.DATABASE_URL || "http://not-configured");
if (
  database.hostname !== "127.0.0.1" ||
  database.port !== "55432" ||
  database.pathname !== "/tracking_follow_through_test"
)
  throw new Error(
    "Monitoring persistence tests require the isolated local database on port 55432.",
  );
const prefix = `coach-monitor-test-${randomUUID()}`;
const sunday = new Date("2026-09-27T18:07:00Z");
const later = (days: number) => new Date(sunday.getTime() + days * 86400000);
let user: User;
let running: string, meditation: string, fitness: string, runActivity: string;

function agreement(
  planId: string,
  role: "training" | "consistency" | "tracking",
): PlanSupport {
  return {
    planId,
    mode: "WEEKLY",
    weekdays: [],
    time: null,
    timezone: "UTC",
    durationMinutes: 30,
    format: "LOG",
    resourceName: null,
    resourceUrl: null,
    nextStep: "",
    effectiveDate: "2026-09-01",
    coaching: {
      role,
      followUps: true,
      dataAccess: { workouts: false, sleep: false },
    },
    preferences: {
      coaching: role !== "tracking",
      reminder: false,
      reminderMinutes: 30,
      dayReminderTime: "09:00",
      checkIn: false,
      checkInTime: "10:00",
      weeklyReview: role !== "tracking",
      reviewDay: 0,
      reviewTime: "18:00",
    },
  };
}
async function saved() {
  return (
    await prisma.coachingState.findUniqueOrThrow({ where: { userId: user.id } })
  ).data as unknown as FollowThroughState;
}
async function messages() {
  return prisma.message.findMany({
    where: { chat: { userId: user.id }, role: "COACH" },
    orderBy: { createdAt: "asc" },
  });
}
async function notifications() {
  return prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
}

beforeEach(async () => {
  vi.resetAllMocks();
  external.push.mockResolvedValue({ platform: "none" });
  external.generate.mockResolvedValue({
    draftMessages: [
      {
        content:
          "You logged your planned runs and two meditations. Keep the same rhythm this week.",
        requiresReply: false,
      },
    ],
  });
  user = await prisma.user.create({
    data: {
      id: `${prefix}-${randomUUID()}`,
      email: `${randomUUID()}@example.invalid`,
      planType: "PLUS",
      timezone: "UTC",
    },
  });
  const activity = await prisma.activity.create({
    data: {
      userId: user.id,
      title: "Running",
      emoji: "🏃",
      measure: "kilometers",
    },
  });
  runActivity = activity.id;
  const run = await prisma.plan.create({
    data: {
      userId: user.id,
      goal: "Run my first half marathon under 2 hours",
      outlineType: "TIMES_PER_WEEK",
      timesPerWeek: 3,
      finishingDate: new Date("2027-03-28"),
      coachNotes: JSON.stringify({
        baseline: "New to running, 2 easy runs of 3 km a week",
        goalReason: "Finish with my friends",
      }),
      activities: { connect: { id: runActivity } },
    },
  });
  running = run.id;
  meditation = (
    await prisma.plan.create({
      data: {
        userId: user.id,
        goal: "Meditate three times a week",
        goalReason: "Respond more calmly when angry",
        timesPerWeek: 3,
        outlineType: "TIMES_PER_WEEK",
      },
    })
  ).id;
  fitness = (
    await prisma.plan.create({
      data: {
        userId: user.id,
        goal: "Exercise four times a week with friends",
        timesPerWeek: 4,
        outlineType: "TIMES_PER_WEEK",
      },
    })
  ).id;
  await changeState(user.id, async (state) =>
    Object.assign(state, {
      ...initialState(),
      enabled: true,
      supports: {
        [running]: agreement(running, "training"),
        [meditation]: agreement(meditation, "consistency"),
        [fitness]: agreement(fitness, "tracking"),
      },
    }),
  );
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
});

describe("The coach across reused running, meditation and fitness plans", () => {
  it("follows the new question after a reply, without reminding about the old question or accepting a reply about another plan", async () => {
    await changeState(user.id, async (state) => {
      state.supports[meditation].preferences.weeklyReview = false;
    });
    external.generate.mockResolvedValue({
      draftMessages: [
        { content: "Which days can you run?", requiresReply: true },
      ],
    });
    await monitorUser(user, sunday);
    const [first] = await messages();
    await resolveCoachConversation(user.id, running);
    const question = await prisma.message.create({
      data: {
        chatId: first.chatId,
        role: "COACH",
        planId: running,
        content:
          "You chose Tuesday and Saturday. How far is your comfortable run?",
        createdAt: new Date(sunday.getTime() + 60000),
        metadata: { requiresReply: true },
      },
    });
    await recordCoachRequests(user.id, [question]);
    await recordCoachRequests(user.id, [question]);
    await resolveCoachConversation(user.id, meditation);
    expect((await saved()).monitoring?.requests).toHaveLength(2);
    expect((await saved()).monitoring?.requests[1].resolvedAt).toBeUndefined();
    expect(await monitorUser(user, new Date(later(3).getTime() + 120000))).toBe(
      "delivered",
    );
    const sent = await notifications();
    expect((sent.at(-1)!.relatedData as { messageId: string }).messageId).toBe(
      question.id,
    );
    expect(await messages()).toHaveLength(2);
    await resolveCoachConversation(user.id);
    expect((await saved()).monitoring?.requests[1].resolvedAt).toBeTruthy();
  });

  it("keeps health-bearing conversation and proposal history within its granted plan and removes it from future context after revocation", async () => {
    const access = [{ planId: running, workouts: true, sleep: false }];
    const history = toCoachConversationHistory([
      {
        role: "COACH",
        content: "Your recorded heart rate was 145.",
        metadata: {
          healthDataAccess: access,
          planProposals: [
            { description: "Adjust using your watch data", status: null },
          ],
        },
      },
    ]);
    expect(history).toHaveLength(2);
    expect(permittedCoachHistory(history, access)).toHaveLength(2);
    expect(permittedCoachHistory(history, [])).toEqual([]);
    expect(
      permittedCoachHistory(history, [
        { planId: meditation, workouts: true, sleep: false },
      ]),
    ).toEqual([]);
    expect(
      permittedCoachHistory(history, [
        { planId: running, workouts: false, sleep: true },
      ]),
    ).toEqual([]);
  });

  it("stays quiet for tracking, then combines two due reviews into one conversation and notification despite concurrent runs", async () => {
    await changeState(user.id, async (state) => {
      state.supports[running].coaching!.role = "tracking";
      state.supports[meditation].coaching!.role = "tracking";
    });
    expect(await monitorUser(user, sunday)).toBe("quiet");
    expect(external.generate).not.toHaveBeenCalled();
    await changeState(user.id, async (state) => {
      state.supports[running].coaching!.role = "training";
      state.supports[meditation].coaching!.role = "consistency";
    });
    const results = await Promise.all([
      monitorUser(user, sunday),
      monitorUser(user, sunday),
    ]);
    expect(results.filter((r) => r === "delivered")).toHaveLength(1);
    expect(external.generate).toHaveBeenCalledTimes(1);
    expect(
      external.generate.mock.calls[0][0].plans
        .map((p: { id: string }) => p.id)
        .sort(),
    ).toEqual([running, meditation].sort());
    const [message] = await messages();
    const [notification] = await notifications();
    expect((notification.relatedData as { url: string }).url).toContain(
      `messageId=${message.id}`,
    );
    expect((message.metadata as { planIds: string[] }).planIds).toEqual(
      [running, meditation].sort(),
    );
    expect(await monitorUser(user, new Date(sunday.getTime() + 3600000))).toBe(
      "quiet",
    );
    expect(await messages()).toHaveLength(1);
    expect(await notifications()).toHaveLength(1);
  });

  it("uses an explicitly difficult log to propose an adjustment; nothing changes before acceptance and stale suggestions cannot overwrite edits", async () => {
    await changeState(user.id, async (state) => {
      for (const s of Object.values(state.supports))
        s.preferences.weeklyReview = false;
    });
    await prisma.activityEntry.create({
      data: {
        userId: user.id,
        activityId: runActivity,
        quantity: 3,
        datetime: sunday,
        updatedAt: sunday,
        difficulty: "hard",
        privateNotes:
          "Had to walk on every hill; can we make next week easier?",
      },
    });
    external.generate.mockResolvedValue({
      draftMessages: [
        {
          content:
            "You reported difficulty on the hills. Review a lighter week.",
          planProposals: [
            {
              planId: running,
              planGoal: "Half marathon",
              planEmoji: "🏃",
              description: "Two runs next week",
              patch: { plan: { timesPerWeek: 2 } },
              status: null,
            },
          ],
        },
      ],
    });
    expect(await monitorUser(user, sunday)).toBe("delivered");
    const [message] = await messages();
    const basis = (message.metadata as { planBasis: Record<string, string> })
      .planBasis[running];
    expect(
      (await prisma.plan.findUniqueOrThrow({ where: { id: running } }))
        .timesPerWeek,
    ).toBe(3);
    expect((await saved()).monitoring?.requests[0].requiresReply).toBe(true);
    await prisma.plan.update({
      where: { id: running },
      data: { timesPerWeek: 4 },
    });
    await expect(
      executePlanProposalPatch({
        planId: running,
        userId: user.id,
        patch: { plan: { timesPerWeek: 2 } },
        expectedBasis: basis,
      }),
    ).rejects.toBeInstanceOf(StaleCoachProposalError);
    expect(
      (await prisma.plan.findUniqueOrThrow({ where: { id: running } }))
        .timesPerWeek,
    ).toBe(4);
    // After asking the coach to reconsider, a freshly reviewed proposal can be applied once.
    const current = await prisma.plan.findUniqueOrThrow({
      where: { id: running },
      include: { activities: true, sessions: true, milestones: true },
    });
    const updatedBasis = planProposalBasis(current);
    await executePlanProposalPatch({
      planId: running,
      userId: user.id,
      patch: { plan: { timesPerWeek: 2 } },
      expectedBasis: updatedBasis,
    });
    expect(
      (await prisma.plan.findUniqueOrThrow({ where: { id: running } }))
        .timesPerWeek,
    ).toBe(2);
    await expect(
      executePlanProposalPatch({
        planId: running,
        userId: user.id,
        patch: { plan: { timesPerWeek: 2 } },
        expectedBasis: updatedBasis,
      }),
    ).rejects.toBeInstanceOf(StaleCoachProposalError);
  });

  it("a quiet habit gets one reminder, then one 'why you started' message with an archive offer; ignoring that pauses contact and never archives by itself", async () => {
    external.generate.mockResolvedValueOnce({
      draftMessages: [
        {
          content:
            "There are no meditation logs this week. Did you practise without logging, or would you like to change the goal?",
          requiresReply: true,
        },
      ],
    });
    await changeState(user.id, async (state) => {
      state.supports[running].preferences.weeklyReview = false;
    });
    await monitorUser(user, sunday);
    const [question] = await messages();
    await prisma.message.update({
      where: { id: question.id },
      data: { readAt: later(1) },
    });
    // Reading is not replying: one reminder push, no new message.
    expect(await monitorUser(user, later(3))).toBe("delivered");
    expect(await messages()).toHaveLength(1);
    expect(await notifications()).toHaveLength(2);
    expect(await monitorUser(user, later(4))).toBe("quiet");

    // A week after the reminder: the coach reminds them why they started and offers to archive.
    external.generate.mockImplementationOnce(async ({ decision, plans }) => ({
      draftMessages: [
        {
          content: "Meditation has been sitting unused. You started it to respond more calmly when angry. Archive it, or log a session to keep going?",
          requiresReply: true,
          planProposals: [
            { planId: plans[0].id, planGoal: plans[0].goal, description: `Archive (${decision.kind})`, patch: { archive: true }, status: null },
          ],
        },
      ],
    }));
    expect(await monitorUser(user, later(10))).toBe("delivered");
    expect(external.generate.mock.calls[1][0].decision).toMatchObject({
      kind: "lapse",
      planIds: [meditation],
    });
    expect(await messages()).toHaveLength(2);

    // Ignoring the archive offer pauses contact; the plan stays, nothing is logged for them.
    expect(await monitorUser(user, later(17))).toBe("quiet");
    expect(await monitorUser(user, later(24))).toBe("quiet");
    expect((await saved()).monitoring?.pausedPlanIds).toEqual([meditation]);
    expect(
      (await prisma.plan.findUniqueOrThrow({ where: { id: meditation } }))
        .archivedAt,
    ).toBeNull();
    expect(
      await prisma.activityEntry.count({ where: { userId: user.id } }),
    ).toBe(0);
    expect(external.generate).toHaveBeenCalledTimes(2);
  });

  it("logging the habit again before the archive offer cancels it", async () => {
    await changeState(user.id, async (state) => {
      state.supports[running].preferences.weeklyReview = false;
      state.monitoring = { ...monitoringState(), lapsePlanIds: [meditation] };
    });
    const activity = await prisma.activity.create({
      data: { userId: user.id, title: "Meditation", emoji: "🧘", measure: "minutes" },
    });
    await prisma.plan.update({
      where: { id: meditation },
      data: { activities: { connect: { id: activity.id } } },
    });
    await prisma.activityEntry.create({
      data: { userId: user.id, activityId: activity.id, datetime: later(2), quantity: 10 },
    });
    expect(await monitorUser(user, later(3))).toBe("quiet");
    expect((await saved()).monitoring?.lapsePlanIds).toEqual([]);
    expect(external.generate).not.toHaveBeenCalled();
  });

  it("replying from the unfiltered All thread answers the open question", async () => {
    external.generate.mockResolvedValue({
      draftMessages: [{ content: "How did the week feel?", requiresReply: true }],
    });
    await monitorUser(user, sunday);
    const [question] = await messages();
    // A plan-less chat message in between, then the reply, all without a plan filter.
    await prisma.message.create({
      data: { chatId: question.chatId, role: "COACH", content: "Unrelated answer", createdAt: later(1) },
    });
    await resolveCoachConversation(user.id);
    expect((await saved()).monitoring?.requests[0].resolvedAt).toBeTruthy();
    expect(await monitorUser(user, later(3))).toBe("quiet");
  });

  it("drops a review prepared against old information when the person pauses a plan or logs during generation; the next run can handle a newly requested training design", async () => {
    external.generate.mockImplementationOnce(async () => {
      await prisma.plan.update({
        where: { id: running },
        data: { isPaused: true },
      });
      await prisma.activityEntry.create({
        data: {
          userId: user.id,
          activityId: runActivity,
          datetime: sunday,
          quantity: 4,
        },
      });
      return {
        draftMessages: [{ content: "Outdated review", requiresReply: true }],
      };
    });
    expect(await monitorUser(user, sunday)).toBe("discarded");
    expect(await messages()).toHaveLength(0);
    expect(await notifications()).toHaveLength(0);
    await changeState(user.id, async (state) => {
      state.supports[fitness].coaching!.role = "training";
      state.supports[fitness].preferences.coaching = true;
      state.monitoring!.setupPlanIds = [fitness];
    });
    external.generate.mockResolvedValueOnce({
      draftMessages: [
        {
          content:
            "Which exercises do you currently do with your friends? That determines the first week's sessions.",
          requiresReply: true,
        },
      ],
    });
    expect(await monitorUser(user, sunday)).toBe("delivered");
    expect((await messages())[0].planId).toBe(fitness);
    expect((await saved()).monitoring?.setupPlanIds).toEqual([fitness]);
    expect(await prisma.planSession.count({ where: { planId: fitness } })).toBe(
      0,
    );
    await resolveCoachConversation(user.id, meditation);
    expect((await saved()).monitoring?.requests[0].resolvedAt).toBeUndefined();
    await resolveCoachConversation(user.id, fitness);
    expect((await saved()).monitoring?.requests[0].resolvedAt).toBeTruthy();
    external.generate.mockResolvedValueOnce({
      draftMessages: [{
        content: "Here is a first week to review.",
        planProposals: [{
          planId: fitness,
          planGoal: "Exercise four times a week with friends",
          planEmoji: null,
          description: "Review first week",
          patch: { plan: { outlineType: "SPECIFIC" } },
          status: null,
        }],
      }],
    });
    expect(await monitorUser(user, later(1))).toBe("delivered");
    expect((await saved()).monitoring?.setupPlanIds).toEqual([]);
  });

  it("does not send a second first-week design after a plan-scoped chat reply proposes sessions", async () => {
    await changeState(user.id, async (state) => {
      state.monitoring ??= monitoringState();
      state.monitoring.setupPlanIds = [running];
    });
    const coach = await prisma.coach.create({ data: { ownerId: user.id, type: "AI" } });
    const chat = await prisma.chat.create({ data: { userId: user.id, type: "COACH", coachId: coach.id } });
    const reply = await prisma.message.create({
      data: {
        chatId: chat.id,
        role: "COACH",
        planId: running,
        content: "Here is your first week to review.",
        metadata: {
          planProposals: [{
            planId: running,
            status: null,
            patch: { sessions: { upsert: [{ activityId: runActivity, date: "2026-09-29", quantity: 3 }] } },
          }],
        },
      },
    });
    await recordCoachRequests(user.id, [reply]);
    expect((await saved()).monitoring?.setupPlanIds).toEqual([]);
    expect(await monitorUser(user, new Date(reply.createdAt.getTime() + 3600000))).toBe("quiet");
    expect(external.generate).not.toHaveBeenCalled();
  });

  it("training: a session check nobody answers counts as missed after a day, and a late log still wins", async () => {
    await changeState(user.id, async (state) => {
      const s = state.supports[running];
      s.mode = "TIMED";
      s.time = "17:00";
      s.weekdays = [0];
      s.preferences.checkIn = true;
      for (const support of Object.values(state.supports))
        support.preferences.weeklyReview = false;
    });
    expect(await monitorUser(user, sunday)).toBe("delivered");
    const sessionId = (await saved()).monitoring!.requests[0].sessionId!;
    expect(await monitorUser(user, new Date(sunday.getTime() + 3600000))).toBe("quiet");
    expect((await saved()).sessions[sessionId].outcome).toBe("UNCONFIRMED");
    await monitorUser(user, later(1));
    expect((await saved()).sessions[sessionId]).toMatchObject({
      outcome: "SKIPPED",
      assumedMissed: true,
    });
    expect(await notifications()).toHaveLength(1);
    await prisma.activityEntry.create({
      data: { userId: user.id, activityId: runActivity, datetime: sunday, quantity: 3 },
    });
    await monitorUser(user, later(2));
    expect((await saved()).sessions[sessionId].outcome).toBe("DONE");
    expect((await saved()).sessions[sessionId].assumedMissed).toBeUndefined();
  });

  it("a missing scheduled run stays unconfirmed; logging it later resolves the question, and watch data requires the matching plan's explicit consent", async () => {
    await changeState(user.id, async (state) => {
      const s = state.supports[running];
      s.mode = "TIMED";
      s.time = "17:00";
      s.weekdays = [0];
      s.preferences.checkIn = true;
      for (const support of Object.values(state.supports))
        support.preferences.weeklyReview = false;
    });
    // Check is due at 17:45, within the hourly polling window.
    expect(await monitorUser(user, sunday)).toBe("delivered");
    expect(external.generate).not.toHaveBeenCalled();
    const sessionId = (await saved()).monitoring!.requests[0].sessionId!;
    expect((await saved()).sessions[sessionId].outcome).toBe("UNCONFIRMED");
    await prisma.activityEntry.create({
      data: {
        userId: user.id,
        activityId: runActivity,
        datetime: sunday,
        quantity: 3,
      },
    });
    await monitorUser(user, later(1));
    expect((await saved()).monitoring!.requests[0].resolvedAt).toBeTruthy();
    expect((await saved()).sessions[sessionId].outcome).toBe("DONE");
    await prisma.healthWorkout.create({
      data: {
        userId: user.id,
        externalId: randomUUID(),
        activityTypeCode: 37,
        activityTypeName: "running",
        startAt: new Date(),
        endAt: new Date(),
        durationSeconds: 1800,
        distanceMeters: 4000,
        sourceName: "Apple Watch",
        sourceBundleId: "com.apple.health",
        metadata: {
          averageHeartRateBpm: 143,
          workoutEffortScore: 6,
          secretRoute: "NEVER SEND THIS",
        },
      },
    });
    expect(await permittedCoachContext(user.id, [running])).not.toContain(
      '"averageHeartRateBpm":143',
    );
    await changeState(user.id, async (state) => {
      state.supports[running].coaching!.dataAccess.workouts = true;
    });
    const permitted = await permittedCoachContext(user.id, [running]);
    expect(permitted).toContain('"averageHeartRateBpm":143');
    expect(permitted).not.toContain("NEVER SEND THIS");
    expect(await permittedCoachContext(user.id, [meditation])).not.toContain(
      '"averageHeartRateBpm":143',
    );
    await changeState(user.id, async (state) => {
      state.supports[running].coaching!.dataAccess.workouts = false;
    });
    expect(await permittedCoachContext(user.id, [running])).not.toContain(
      '"averageHeartRateBpm":143',
    );
  });
});

describe("Measurements the coach asks for", () => {
  it("accepting 'also track weight' adds it to the plan once, reusing an existing Weight activity", async () => {
    const weight = { title: "Weight", measure: "kg", emoji: "⚖️" };
    await executePlanProposalPatch({ planId: running, userId: user.id, patch: { track: [weight] } });
    await executePlanProposalPatch({ planId: fitness, userId: user.id, patch: { track: [weight] } });
    const plans = await prisma.plan.findMany({
      where: { id: { in: [running, fitness] } },
      include: { activities: true },
    });
    const weightIds = plans.flatMap((p) => p.activities.filter((a) => a.title === "Weight").map((a) => a.id));
    expect(weightIds).toHaveLength(2);
    expect(new Set(weightIds).size).toBe(1);
  });
});

describe("Contact limits and failed deliveries", () => {
  it("discards a review if a permitted watch workout arrives while the coach is preparing it", async () => {
    await changeState(user.id, async (state) => {
      state.supports[running].coaching!.dataAccess.workouts = true;
    });
    external.generate.mockImplementationOnce(async () => {
      await prisma.healthWorkout.create({
        data: {
          userId: user.id,
          externalId: randomUUID(),
          activityTypeCode: 37,
          activityTypeName: "running",
          startAt: sunday,
          endAt: sunday,
          durationSeconds: 1800,
          sourceName: "Apple Watch",
          sourceBundleId: "com.apple.health",
        },
      });
      return {
        draftMessages: [
          { content: "A review based on the older workout history" },
        ],
      };
    });
    expect(await monitorUser(user, sunday)).toBe("discarded");
    expect(await messages()).toHaveLength(0);
    expect(await notifications()).toHaveLength(0);
  });

  it("a model deciding to stay quiet is remembered for that review window", async () => {
    external.generate.mockResolvedValue({ draftMessages: [], skipped: true });
    expect(await monitorUser(user, sunday)).toBe("discarded");
    expect(await monitorUser(user, new Date(sunday.getTime() + 3600000))).toBe(
      "quiet",
    );
    expect(external.generate).toHaveBeenCalledTimes(1);
    expect(await notifications()).toHaveLength(0);
  });
  it("a model failure does not consume the review or leave a stuck generation lock", async () => {
    external.generate.mockRejectedValueOnce(new Error("Gateway unavailable"));
    await expect(monitorUser(user, sunday)).rejects.toThrow(
      "Gateway unavailable",
    );
    expect(await messages()).toHaveLength(0);
    expect((await saved()).monitoring?.lease).toBeUndefined();
    expect(await monitorUser(user, sunday)).toBe("delivered");
  });
  it("push failure cannot produce a second copy of the message on retry", async () => {
    external.push.mockRejectedValueOnce(new Error("Ambiguous push timeout"));
    await expect(monitorUser(user, sunday)).rejects.toThrow(
      "Ambiguous push timeout",
    );
    expect(await monitorUser(user, sunday)).toBe("quiet");
    expect(await messages()).toHaveLength(1);
    expect(await notifications()).toHaveLength(1);
  });
  it("keeps the review in Messages without pushing when the user is viewing the coach", async () => {
    await changeState(user.id, async (state) => {
      state.monitoring = {
        requests: [],
        reviewed: {},
        consideredEntries: {},
        pausedPlanIds: [],
        viewingUntil: new Date(sunday.getTime() + 60000).toISOString(),
      };
    });
    expect(await monitorUser(user, sunday)).toBe("delivered");
    expect(await messages()).toHaveLength(1);
    expect(external.push).not.toHaveBeenCalled();
  });
  it("honors the saved local review time across daylight saving changes and a subscription ending", async () => {
    await changeState(user.id, async (state) => {
      for (const s of Object.values(state.supports)) {
        s.timezone = "Europe/Lisbon";
        s.preferences.reviewTime = "18:30";
      }
    });
    expect(await monitorUser(user, new Date("2026-10-18T17:07:00Z"))).toBe(
      "quiet",
    );
    expect(await monitorUser(user, new Date("2026-10-18T18:07:00Z"))).toBe(
      "delivered",
    );
    expect(await monitorUser(user, new Date("2026-10-25T18:07:00Z"))).toBe(
      "quiet",
    );
    expect(await monitorUser(user, new Date("2026-10-25T19:07:00Z"))).toBe(
      "delivered",
    );
    await prisma.user.update({
      where: { id: user.id },
      data: { planType: "FREE" },
    });
    expect(await monitorUser(user, new Date("2026-11-01T19:07:00Z"))).toBe(
      "quiet",
    );
  });
  it("stops after an unanswered review even when reminders were not permitted", async () => {
    await changeState(user.id, async (state) => {
      for (const s of Object.values(state.supports))
        s.coaching!.followUps = false;
    });
    external.generate.mockResolvedValue({
      draftMessages: [
        {
          content: "Would you like to keep the same weekly goals?",
          requiresReply: true,
        },
      ],
    });
    await monitorUser(user, sunday);
    expect(await monitorUser(user, later(3))).toBe("quiet");
    expect(await monitorUser(user, later(7))).toBe("quiet");
    expect((await saved()).monitoring?.pausedPlanIds.sort()).toEqual(
      [running, meditation].sort(),
    );
    expect(await notifications()).toHaveLength(1);
  });
  it("discards work when the person pauses all outreach during generation", async () => {
    external.generate.mockImplementationOnce(async () => {
      await changeState(user.id, async (state) => {
        state.monitoring!.outreachPaused = true;
      });
      return { draftMessages: [{ content: "A review they no longer want" }] };
    });
    expect(await monitorUser(user, sunday)).toBe("discarded");
    expect(await messages()).toHaveLength(0);
    expect(await monitorUser(user, later(7))).toBe("quiet");
  });
});
