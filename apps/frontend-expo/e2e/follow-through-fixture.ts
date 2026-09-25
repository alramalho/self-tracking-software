import { interviewFixture } from "./interview-fixture";
import type {
  FollowThroughState,
  OnboardingDraft,
} from "@tsw/prisma/follow-through";
import { randomUUID } from "node:crypto";
export const freshSupport = (): FollowThroughState => ({
  version: 1,
  enabled: false,
  pausedAt: null,
  supports: {},
  sessions: {},
  checks: {},
  draft: null,
});
let support = freshSupport();
export const resetFollowThrough = () => {
  support = freshSupport();
};
export function followThroughFixture(
  path: string,
  method: string,
  body: any,
  state: any,
): unknown | undefined {
  if (path === "/__coaching-monitoring") {
    followThroughFixture("/__follow-through", "POST", {}, state);
    Object.assign(state.plans[0], { goal: "Run my first half marathon", timesPerWeek: 3 });
    Object.assign(state.plans[1], { goal: "Meditate consistently", emoji: "🧘" });
    const planId = state.plans[0].id;
    support.supports[planId].coaching = { role: "training", followUps: true, dataAccess: { workouts: false, sleep: false } };
    support.monitoring = { reviewed: {}, consideredEntries: {}, pausedPlanIds: [], requests: [{
      id: "review-test", planIds: [planId], kind: "review", messageId: "coach-plan-review", chatId: "coach-main", createdAt: new Date().toISOString(), requiresReply: true,
    }] };
    state.messages = [
      { id: "coach-meditation", chatId: "coach-main", planId: state.plans[1].id, role: "COACH", status: "SENT", content: "You logged two meditations this week. Keep the same goal.", createdAt: new Date(Date.now() - 60000).toISOString() },
      { id: "coach-plan-review", chatId: "coach-main", planId, planIds: [planId], role: "COACH", status: "SENT", requiresReply: true, content: "You said the hills felt too hard. Review a lighter week with two runs.", createdAt: new Date().toISOString(),
        planProposals: [{ planId, planGoal: state.plans[0].goal, planEmoji: "🏃", description: "A lighter week", patch: { plan: { timesPerWeek: 2 } }, status: null }] },
    ];
    if (body?.messages) state.messages = body.messages;
    if (body?.monitoring) Object.assign(support.monitoring, body.monitoring);
    for (const update of body?.planOverrides ?? []) {
      const plan = state.plans.find((p: any) => p.id === update.id);
      if (plan) Object.assign(plan, update);
    }
    return { ok: true };
  }
  // Homepage coach states: one plan on track (green), one slipping with a prepared nudge (amber),
  // one in its normal rhythm (no ring).
  if (path === "/__plan-nudges") {
    followThroughFixture("/__follow-through", "POST", {}, state);
    const day = 86400000, ago = (n: number) => new Date(Date.now() - n * day).toISOString();
    const activity = (id: string, title: string, emoji: string, measure: string) =>
      ({ id, title, emoji, measure, colorHex: "#3b82f6", userId: "test-user" });
    const run = activity("run", "Running", "🏃", "kilometers"),
      guitar = activity("guitar", "Guitar", "🎸", "minutes"),
      read = activity("read", "Reading", "📚", "pages"),
      stretch = activity("stretch", "Stretching", "🧘", "minutes");
    state.activities = [run, guitar, read, stretch];
    const plan = (id: string, goal: string, emoji: string, a: any, order: number) => ({
      ...state.plans[0], id, goal, emoji, activities: [a], sessions: [], milestones: [],
      outlineType: "TIMES_PER_WEEK", timesPerWeek: 3, createdAt: ago(30), sortOrder: order,
      pauseHistory: [], isPaused: false, progress: { weeks: [] },
    });
    state.plans = [
      plan("half", "Run my first half marathon", "🏃", run, 0),
      plan("guitar", "Practice guitar", "🎸", guitar, 1),
      plan("reading", "Read before bed", "📚", read, 2),
      { ...plan("stretch", "Stretch every morning", "🧘", stretch, 3), timesPerWeek: 1 },
    ];
    // Missed last week (no grace week): reading is also at risk now, stretch already made up for it.
    const lastSunday = new Date(Date.now() - 7 * day);
    lastSunday.setDate(lastSunday.getDate() - lastSunday.getDay());
    const missedWeek = (planId: string, streak: number, before: number, done: string[], target: number) => {
      const p = state.plans.find((x: any) => x.id === planId);
      p.progress = {
        achievement: { streak, missedLastWeek: { streakBefore: before, streakAfter: before - 1, inARow: 1 } },
        habitAchievement: { isAchieved: false, maxValue: 4 },
        lifestyleAchievement: { isAchieved: false, maxValue: 9 },
        weeks: [{ startDate: lastSunday.toISOString(), isCompleted: false, plannedActivities: target,
          completedActivities: done.map((d) => ({ datetime: d })) }],
      };
    };
    missedWeek("reading", 1, 2, [ago(9)], 3);
    missedWeek("stretch", 3, 3, [], 1);
    const entry = (id: string, activityId: string, daysAgo: number, quantity: number) =>
      ({ id, activityId, userId: "test-user", datetime: ago(daysAgo), createdAt: ago(daysAgo), quantity, comments: [], reactions: [] });
    state.entries = [
      entry("r1", "run", 1, 5), entry("r2", "run", 3, 6), entry("r3", "run", 5, 5),
      entry("g1", "guitar", 6, 20),
      entry("b1", "read", 2, 15),
      entry("s1", "stretch", 1, 10),
    ];
    const base = Object.values(support.supports)[0] as any;
    const coached = (planId: string, role: string) => ({
      ...base, planId, mode: "WEEKLY", weekdays: [], time: null,
      coaching: { role, followUps: true, dataAccess: { workouts: false, sleep: false } },
    });
    support.supports = {
      half: coached("half", "training"),
      guitar: coached("guitar", "consistency"),
      reading: coached("reading", "consistency"),
      stretch: { ...coached("stretch", "tracking"), coaching: undefined },
    };
    support.monitoring = { reviewed: {}, consideredEntries: {}, pausedPlanIds: [], requests: [{
      id: "nudge:guitar", planIds: ["guitar"], kind: "nudge", messageId: "coach-nudge-guitar",
      chatId: "coach-main", createdAt: ago(0.1), requiresReply: true,
    }] };
    state.messages = [{
      id: "coach-nudge-guitar", chatId: "coach-main", planId: "guitar", planIds: ["guitar"],
      role: "COACH", status: "SENT", requiresReply: true, createdAt: ago(0.1),
      content: "No guitar logged for six days. You started because you wanted to finally play songs with friends. Get back to it tomorrow, or let it go?",
      nudge: { planId: "guitar" },
    }];
    return { ok: true };
  }
  const nudgeAnswer = path.match(/^\/follow-through\/nudges\/([^/]+)$/);
  if (nudgeAnswer && method === "POST") {
    const message = state.messages.find((m: any) => m.id === nudgeAnswer[1]);
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(9, 0, 0, 0);
    message.nudge = { ...message.nudge, outcome: body.action, ...(body.action === "remind" ? { remindAt: tomorrow.toISOString() } : {}) };
    for (const r of support.monitoring?.requests ?? []) if (r.messageId === message.id) r.resolvedAt = new Date().toISOString();
    return message.nudge;
  }
  if (path === "/follow-through/coaching/presence") return { ok: true };
  if (path === "/follow-through/coaching/resume") {
    if (support.monitoring) support.monitoring.pausedPlanIds = support.monitoring.pausedPlanIds.filter(id => id !== body.planId);
    return { ok: true };
  }
  const planMessages = path.match(/^\/plans\/([^/]+)\/coach-action-messages$/);
  if (planMessages) return { messages: state.messages.filter((m: any) => m.planProposals?.some((p: any) => p.planId === planMessages[1] && !p.status)) };
  const decision = path.match(/^\/ai\/messages\/([^/]+)\/(accept|reject)-proposal$/);
  if (decision) {
    const proposal = state.messages.find((m: any) => m.id === decision[1])?.planProposals?.[body.proposalIndex];
    if (proposal && !proposal.status) {
      proposal.status = decision[2] === "accept" ? "accepted" : "rejected";
      if (decision[2] === "accept") {
        const plan = state.plans.find((p: any) => p.id === proposal.planId);
        Object.assign(plan, proposal.patch?.plan);
        for (const session of proposal.patch?.sessions?.upsert ?? []) {
          plan.sessions.push({ ...session, id: session.id ?? randomUUID(), planId: plan.id, isCoachSuggested: true, createdAt: new Date().toISOString(), imageUrls: [] });
        }
      }
      support.monitoring?.requests.filter(r => r.messageId === decision[1]).forEach(r => { r.resolvedAt = new Date().toISOString(); });
    }
    return { success: true };
  }
  if (path === "/__follow-through") {
    const plan = state.plans[0],
      today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Europe/Lisbon",
      });
    plan.progress = {
      ...plan.progress,
      achievement: { streak: 20 },
      habitAchievement: { isAchieved: false },
      lifestyleAchievement: { isAchieved: true, maxValue: 9 },
    };
    support.enabled = true;
    support.supports[plan.id] = {
      planId: plan.id,
      mode: "TIMED",
      weekdays: [2],
      time: "18:00",
      timezone: "Europe/Lisbon",
      durationMinutes: 20,
      format: "TIMER",
      resourceUrl: null,
      resourceName: null,
      nextStep: "Put on my shoes and start my planned session.",
      preferences: {
        coaching: true,
        reminder: false,
        reminderMinutes: 30,
        dayReminderTime: "09:00",
        checkIn: true,
        checkInTime: "10:00",
        weeklyReview: true,
        reviewDay: 0,
        reviewTime: "18:00",
      },
      effectiveDate: today,
    };
    support.sessions["session-check"] = {
      id: "session-check",
      planId: plan.id,
      activityId: plan.activities[0].id,
      date: today,
      time: "18:00",
      timezone: "Europe/Lisbon",
      durationMinutes: 20,
      source: "SPONTANEOUS",
      outcome: "UNCONFIRMED",
      entryId: null,
      startedAt: null,
      elapsedSeconds: 0,
      timerRunning: false,
    };
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    support.sessions["session-next"] = {
      ...support.sessions["session-check"],
      id: "session-next",
      date: tomorrow.toISOString().slice(0, 10),
    };
    if (body?.profileGrid) {
      const sunday = new Date(`${today}T12:00:00Z`);
      sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
      const weeks = Array.from({ length: 10 }, (_, i) => {
        const date = new Date(sunday);
        date.setUTCDate(date.getUTCDate() - i * 7);
        return date;
      });
      plan.createdAt = weeks[9].toISOString();
      state.entries = weeks.flatMap((week, i) =>
        Array.from({ length: i ? 3 : 1 }, (_, day) => {
          const datetime = new Date(week);
          datetime.setUTCDate(datetime.getUTCDate() + day);
          return {
            ...state.entries[0],
            id: `profile-grid-${i}-${day}`,
            activityId: plan.activities[day % plan.activities.length].id,
            datetime: datetime.toISOString(),
            quantity: day + 3,
          };
        }),
      );
      plan.progress.weeks = weeks.map((week, i) => ({
        startDate: week.toISOString(),
        isCompleted: i > 0,
        plannedActivities: 3,
        completedActivities: state.entries.filter((entry: any) => {
          const d = new Date(entry.datetime);
          return d >= week && d.getTime() < week.getTime() + 7 * 86400000;
        }),
      }));
    }
    support.checks.check = {
      id: "check",
      planId: plan.id,
      sessionId: "session-check",
      kind: "SESSION",
      message: "Did your running session happen?",
      dueAt: new Date().toISOString(),
      sentAt: null,
      answeredAt: null,
      dismissedAt: null,
    };
    if (body?.flexibleWeekly) {
      state.plans = [plan];
      plan.activities = [plan.activities[0]];
      support.supports[plan.id].mode = "WEEKLY";
      support.supports[plan.id].weekdays = [];
      support.supports[plan.id].time = null;
    }
    return { ok: true };
  }
  if (path === "/follow-through/calendar")
    return Object.values(support.sessions)
      .filter((session) => session.outcome !== "SKIPPED")
      .map((session) => ({
        sessionId: session.id,
        planId: session.planId,
        title: state.plans.find((p: any) => p.id === session.planId).goal,
        startDate: `${session.date}T17:00:00Z`,
        endDate: `${session.date}T17:20:00Z`,
        allDay: false,
        timeZone: session.timezone,
        url: `trackingso://session/${session.id}`,
      }));
  if (path.startsWith("/follow-through/checks/")) {
    const check = support.checks[decodeURIComponent(path.split("/").at(-1)!)];
    if (body.action === "ANSWER") check.answeredAt = new Date().toISOString();
    else check.dismissedAt = new Date().toISOString();
    return {};
  }
  if (path === "/follow-through")
    return {
      state: support,
      canCoach: state.user.planType !== "FREE",
      serverTime: new Date().toISOString(),
    };
  if (path === "/follow-through/onboarding/draft") {
    support.draft = body;
    return body;
  }
  if (path === "/follow-through/onboarding/goal-guidance") {
    const step = body.step || "goal";
    const rejected = /asdf|ignore.*instructions|bullshit|be better/i.test(body.answer);
    const passed = !rejected && (step === "goal" ? /run|write|learn|meditat|exercise|walk|study|read/i.test(body.answer) : step === "baseline" ? /start|begin|currently|now|run|practice|know|never|week/i.test(body.answer) : /because|express|matters|enjoy|love|feel|friend|calm/i.test(body.answer));
    return {
      requirements: [{
        key: step,
        label: step === "goal" ? "A clear target" : step === "baseline" ? "Starting point" : "Personal reason",
        phrase: "",
        required: step === "goal",
        passed,
        detail: passed ? "This helps shape your plan." : step === "goal" ? "Name one concrete outcome." : "Add a relevant detail, or skip for now.",
      }],
    };
  }
  if (path === "/follow-through/onboarding/interview")
    return interviewFixture(body.state, body.answer);
  if (path === "/follow-through/onboarding/next")
    return body.answers.length
      ? {
          ready: true,
          question: null,
          nextStep:
            "Open your saved chord exercise and practise changing between two chords.",
          explanation:
            "You said switching chords interrupts your playing. Start with one change you can repeat.",
          suggestedFormat: "TIMER",
        }
      : {
          ready: false,
          question: {
            icon: "🎸",
            title: "What interrupts your playing most?",
            purpose: "This chooses the first exercise you will practise.",
            type: "choice",
            options: [
              "Changing chords",
              "Finding notes by ear",
              "Keeping a rhythm",
            ],
          },
          nextStep: "",
          explanation: "",
          suggestedFormat: "LOG",
        };
  if (path === "/follow-through/onboarding/offer")
    return {
      url: "https://example.invalid/test-checkout",
      trialDays: 14,
      amount: 999,
      currency: "eur",
      interval: "month",
      intervalCount: 1,
    };
  if (path === "/follow-through/onboarding/finish") {
    const d: OnboardingDraft = body.draft;
    if (!state.plans.some((p: any) => p.id === d.id)) {
      const a = state.activities.find((a: any) => a.id === d.activityId) || {
        id: randomUUID(),
        userId: state.user.id,
        title: d.activityTitle,
        emoji: d.emoji,
        measure: d.measure,
      };
      if (!state.activities.some((v: any) => v.id === a.id))
        state.activities.push(a);
      state.plans.push({
        id: d.id,
        userId: state.user.id,
        goal: d.goal,
        emoji: d.emoji,
        activities: [a],
        sessions: [],
        outlineType: "TIMES_PER_WEEK",
        timesPerWeek: d.frequency,
        createdAt: new Date().toISOString(),
        visibility: "PRIVATE",
        progress: { weeks: [] },
      });
      support.supports[d.id] = {
        coaching: d.coaching,
        planId: d.id,
        mode: d.commitment,
        weekdays: d.weekdays,
        time: d.time,
        timezone: d.timezone,
        durationMinutes: d.durationMinutes,
        format: d.format,
        resourceName: d.resourceName,
        resourceUrl: d.resourceUrl,
        nextStep: d.nextStep,
        preferences: body.preferences,
        effectiveDate: new Date().toISOString().slice(0, 10),
      };
    }
    support.enabled = true;
    support.draft = { ...d, createdPlanId: d.id };
    state.user.onboardingCompletedAt = new Date().toISOString();
    return { planId: d.id };
  }
  if (path.startsWith("/follow-through/plans/")) {
    const id = path.split("/").at(-1)!;
    support.supports[id] = body;
    support.enabled = true;
    return body;
  }
  if (path === "/follow-through/sessions" && method === "POST") {
    const p = state.plans.find((p: any) => p.id === body.planId),
      s = support.supports[p.id];
    const id = randomUUID();
    support.sessions[id] = {
      id,
      planId: p.id,
      activityId: p.activities[0].id,
      date: body.date,
      time: body.time,
      timezone: s.timezone,
      durationMinutes: s.durationMinutes,
      outcome: "UNCONFIRMED",
      entryId: null,
      startedAt: null,
      elapsedSeconds: 0,
      timerRunning: false,
      source: "SPONTANEOUS",
    };
    return support.sessions[id];
  }
  if (path.startsWith("/follow-through/sessions/")) {
    const [, , , encoded, operation] = path.split("/");
    const id = decodeURIComponent(encoded);
    const s = support.sessions[id];
    if (!s) return { error: "Session missing" };
    if (operation === "timer") {
      if (body.action === "START") {
        s.startedAt = new Date().toISOString();
        s.timerRunning = true;
      } else {
        s.elapsedSeconds += 1;
        s.startedAt = null;
        s.timerRunning = false;
      }
    } else if (operation === "outcome") {
      s.outcome = body.outcome;
      s.entryId = body.entryId || null;
    } else {
      s.date = body.date;
      s.time = body.time;
    }
    return s;
  }
  if (path === "/circles") return { mine: [], discover: [] };
  return undefined;
}
