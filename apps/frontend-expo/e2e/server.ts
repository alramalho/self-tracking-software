import { healthFixture, resetHealthFixture } from "./health-fixture";
import { resetFollowThrough, followThroughFixture } from "./follow-through-fixture";
import { yearPlanStats, inYear } from "../../backend-node/src/services/wrapped/model";
import { rankPeople } from "../../backend-node/src/services/people/rank";
import type { SearchablePerson } from "../../backend-node/src/services/people/types";
import { seedChats } from "./chat-fixtures";
import http from "node:http";
import { readFileSync } from "node:fs";
interface SearchCandidate extends SearchablePerson {
  userId: string;
  name: string;
  username: string;
  activityCount: number;
  lastActivityAt: string | null;
}
const port = Number(process.env.E2E_API_PORT || 4317);
const now = () => new Date().toISOString();
let state: ReturnType<typeof seed>;
let failNext: string | undefined;
let offlineMode = false;
let loseNextLogResponse = false;
const logReceipts = new Map<string, string>();
const photoReceipts = new Map<string, string>();
let peopleSearchOn = false;
let wrappedFriendEntries: { datetime: string }[] = [];
const requests: { method: string; path: string; body: unknown }[] = [];
function seed() {
  const activities = [
    {
      id: "run",
      title: "Running",
      emoji: "🏃",
      measure: "kilometers",
      colorHex: "#3b82f6",
      userId: "test-user",
    },
    {
      id: "read",
      title: "Reading",
      emoji: "📚",
      measure: "pages",
      colorHex: "#8b5cf6",
      userId: "test-user",
    },
  ];
  const today = new Date();
  today.setHours(8, 0, 0, 0);
  const old = new Date(today);
  old.setDate(old.getDate() - 14);
  const entries = [
    {
      id: "entry-run",
      activityId: "run",
      userId: "test-user",
      datetime: today.toISOString(),
      quantity: 5,
      createdAt: today.toISOString(),
      description: "Morning run",
      comments: [],
      reactions: [],
    },
    {
      id: "entry-read",
      activityId: "read",
      userId: "test-user",
      datetime: today.toISOString(),
      quantity: 20,
      createdAt: today.toISOString(),
      description: "A good chapter",
      comments: [],
      reactions: [],
    },
  ];
  const plans = [
    {
      id: "fitness",
      userId: "test-user",
      milestones: [
        {
          id: "milestone-run",
          description: "Build a routine",
          date: now(),
          progress: 20,
          criteria: "Keep showing up",
        },
      ],
      goal: "Exercise regularly",
      emoji: "💪",
      activities,
      sessions: [],
      outlineType: "TIMES_PER_WEEK",
      timesPerWeek: 3,
      durationType: "LIFESTYLE",
      visibility: "PUBLIC",
      createdAt: old.toISOString(),
      sortOrder: 0,
      isPaused: false,
      pauseHistory: [
        {
          pausedAt: old.toISOString(),
          resumedAt: new Date(old.getTime() + 2 * 86400000).toISOString(),
          reason: "Rest",
        },
      ],
      progress: { weeks: [], habitAchievement: { isAchieved: true } },
    },
    {
      id: "scheduled",
      userId: "test-user",
      milestones: [],
      goal: "Read every day",
      emoji: "📖",
      activities: [activities[1]],
      sessions: [
        { id: "session-read", activityId: "read", date: now(), quantity: 10 },
      ],
      outlineType: "SPECIFIC",
      timesPerWeek: 1,
      visibility: "PUBLIC",
      createdAt: old.toISOString(),
      sortOrder: 1,
      progress: { weeks: [] },
    },
  ];
  const metrics = [
    { id: "energy", title: "Energy", emoji: "⚡" },
    { id: "mood", title: "Mood", emoji: "😊" },
  ];
  const metricEntries = Array.from({ length: 14 }, (_, i) => ({
    id: `metric-${i}`,
    metricId: "energy",
    rating: (i % 5) + 1,
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  }));
  const user = {
    id: "test-user",
    name: "Alex",
    username: "alex",
    email: "alex@example.test",
    bio: "Making a little progress every day.",
    planType: "PLUS",
    themeMode: "LIGHT",
    themeBaseColor: "BLUE",
    onboardingCompletedAt: old.toISOString(),
    // AI features allowed, so flows and screenshots skip the consent sheet.
    aiConsentGrantedAt: old.toISOString(),
    aiConsentDeclinedAt: null as string | null,
  };
  const externalProfile = {
    id: "friend-user",
    username: "sam",
    name: "Sam",
    planType: "PLUS",
    accountStats: {
      totalActivitiesLogged: 100,
      totalPoints: 150,
      habitCount: 2,
      lifestyleCount: 0,
    },
    activities: [{ ...activities[0], id: "friend-run", userId: "friend-user" }],
    activityEntries: [
      {
        ...entries[0],
        id: "friend-entry",
        activityId: "friend-run",
        userId: "friend-user",
        quantity: 12,
        description: "Sam's long run",
      },
    ],
    plans: [
      {
        ...plans[0],
        id: "friend-plan",
        userId: "friend-user",
        goal: "Sam's running plan",
        activities: [
          { ...activities[0], id: "friend-run", userId: "friend-user" },
        ],
        milestones: [],
      },
    ],
    connectionsFrom: [],
    connectionsTo: [],
  };
  return {
    activities,
    entries,
    plans,
    metrics,
    metricEntries,
    user,
    achievements: [] as any[],
    notifications: [] as any[],
    ...seedChats(),
    externalProfile,
  };
}
state = seed();
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  const url = new URL(req.url!, "http://localhost");
  const path = url.pathname;
  const send = (body: unknown, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  let body: any = {};
  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  const raw = Buffer.concat(buffers);
  if (raw.length) {
    if (req.headers["content-type"]?.includes("multipart/form-data")) {
      const request = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": req.headers["content-type"] },
        body: raw,
      });
      const form = await request.formData();
      const uploadedPhotos = (form.getAll("photos").filter((value) => typeof value !== "string") as unknown as File[]).map((file) => ({ name: file.name, size: file.size, type: file.type }));
      const formEntries = form as unknown as {
        entries: () => Iterable<[string, unknown]>;
        get: (name: string) => string | File | null;
      };
      const audio = formEntries.get("audio_file");
      body = Object.fromEntries(
        formEntries.entries(),
      );
      if (uploadedPhotos.length) body.uploadedPhotos = uploadedPhotos;
      if (audio && typeof audio !== "string")
        body.uploadedAudio = {
          name: audio.name,
          size: audio.size,
          type: audio.type,
        };
    } else {
      try {
        body = JSON.parse(raw.toString());
      } catch {}
    }
  }
  if (path === "/__reset") {
    state = seed();
    resetFollowThrough();
    resetHealthFixture();
    peopleSearchOn = false;
    wrappedFriendEntries = [];
    requests.length = 0;
    failNext = undefined;
    offlineMode = false;
    loseNextLogResponse = false;
    logReceipts.clear();
    photoReceipts.clear();
    send({ ok: true });
    return;
  }
  if (path === "/__photo-notifications" && req.method === "POST") {
    state.notifications = [{
      id: "photo-entry-friend-user",
      title: "hey Alex 👋",
      message: "@sam added a photo to 🏃 Running 📸",
      type: "INFO",
      status: "PROCESSED",
      relatedId: "friend-entry",
      relatedData: { activityEntryId: "friend-entry", category: "ACTIVITY_PHOTO" },
    }];
    send({ ok: true });
    return;
  }
  if (path === "/__polish") {
    Object.assign(state.plans[0], { notes: "## Training roadmap\nBuild **consistency** first.\n- Three sessions each week\n- Keep a `steady` pace\n[Training guide](https://example.com/guide)" });
    state.user.themeMode = body.theme ?? "DARK";
    Object.assign(state.plans[0], {progress: {weeks:[{startDate:new Date().toISOString(),isCompleted:true,plannedActivities:1,completedActivities:[state.entries[0]]}],achievement:{streak:4},habitAchievement:{isAchieved:true,progressValue:4,maxValue:4},lifestyleAchievement:{isAchieved:false,progressValue:4,maxValue:9}}});
    const counts = [35, 20, 8, 2];
    state.activities = counts.map((count, i) => ({ ...state.activities[0], id: `polish-${i}`, title: ["Gym", "Running", "Chess", "Sauna"][i], emoji: ["🏋️", "🏃", "♟️", "🧖"][i] }));
    state.metricEntries = Array.from({length:45},(_,i)=>({id:`polish-metric-${i}`,metricId:"energy",rating:i%3+1+(i<20?2:0),createdAt:new Date(Date.UTC(2026,8,14-i,12)).toISOString()}));
    state.entries = counts.flatMap((count,index)=>Array.from({length:count},(_,i)=>({ ...state.entries[0],id:`polish-entry-${index}-${i}`,activityId:`polish-${index}`,datetime:new Date(Date.UTC(2026,8,14-i,8)).toISOString(),createdAt:new Date(Date.UTC(2026,8,14-i,8)).toISOString() })));
    send({ok:true}); return;
  }
  if (path === "/__background.png") {
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(readFileSync(new URL("../assets/icon.png", import.meta.url)));
    return;
  }
  if (path === "/__state") {
    send({ ...state, requests });
    return;
  }
  if (path === "/__fail") {
    failNext = body.path;
    send({ ok: true });
    return;
  }
  if (path === "/__offline") {
    offlineMode = body.enabled === true;
    loseNextLogResponse = body.loseNextLogResponse === true;
    send({ offlineMode, loseNextLogResponse });
    return;
  }
  if (path === "/__people-search") {
    peopleSearchOn = true;
    state.externalProfile.username = "liocas";
    state.externalProfile.name = "Lia Borges";
    send({ok:true}); return;
  }
  if (path === "/__wrapped") {
    Object.assign(state.user, { themeMode: body.themeMode ?? state.user.themeMode, themeBaseColor: "AMBER", connectionsFrom: [{id:"friend-connection",status:"ACCEPTED",fromId:state.user.id,toId:state.externalProfile.id,to:state.externalProfile,from:{id:state.user.id}}] });
    state.entries = Array.from({length:36},(_,i)=>({...state.entries[0],id:`wrapped-${i}`,activityId:i%3===0?"read":"run",datetime:new Date(2025,i%12,1+Math.floor(i/12)*8,12).toISOString(),createdAt:new Date(2025,i%12,1+Math.floor(i/12)*8,12).toISOString(),quantity:i%3===0?20:5,timezone:i%2?"Europe/Berlin":"Europe/Lisbon",description:`Memory ${i+1}`,imageUrl:`http://127.0.0.1:${port}/__background.png?wrapped=${i}`,reactions:[]}));
    state.metricEntries = Array.from({length:36},(_,i)=>({id:`wrapped-mood-${i}`,metricId:"mood",rating:i%5+1,createdAt:new Date(2025,i%12,1+Math.floor(i/12)*8,12).toISOString()}));
    Object.assign(state.plans[0].progress,{achievement:{streak:7},habitAchievement:{isAchieved:true},weeks:Array.from({length:10},(_,i)=>({startDate:new Date(2025,0,5+i*7).toISOString(),isCompleted:i<9}))});
    Object.assign(state.plans[1].progress,{achievement:{streak:10},habitAchievement:{isAchieved:true},lifestyleAchievement:{isAchieved:true}});
    state.externalProfile.activityEntries = Array.from({length:40}, (_,i) => ({...state.externalProfile.activityEntries[0], id:`friend-preview-${i}`}));
    Object.assign(state.externalProfile.accountStats, {totalActivitiesLogged:1792,totalPoints:1842,bestStreak:19});
    state.externalProfile.plans[0].progress={...state.externalProfile.plans[0].progress,achievement:{streak:5}} as any;
    Object.assign(state.plans[0].progress, {habitAchievement:{isAchieved:true,achievedAt:"2025-03-01"}});
    Object.assign(state.plans[1].progress, {habitAchievement:{isAchieved:true,achievedAt:"2024-01-01"},lifestyleAchievement:{isAchieved:true,achievedAt:"2025-04-01"},weeks:Array.from({length:9},(_,i)=>({startDate:new Date(Date.UTC(2025,0,5+i*7)).toISOString(),isCompleted:true}))});
    state.externalProfile.plans[0].progress={...state.externalProfile.plans[0].progress,habitAchievement:{achievedAt:"2025-02-01"},lifestyleAchievement:{achievedAt:"2025-03-01"},weeks:[...Array.from({length:19},(_,i)=>({startDate:new Date(Date.UTC(2025,0,5+i*7)).toISOString(),isCompleted:true})),{startDate:"2026-01-04",isCompleted:true}]} as any;
    wrappedFriendEntries = [...Array.from({length:345},()=>({datetime:"2025-06-01"})),...Array.from({length:217},()=>({datetime:"2026-06-01"}))];
    if(body.empty){wrappedFriendEntries=[];state.entries=[];state.metricEntries=[];state.plans=[];Object.assign(state.user,{connectionsFrom:[]});}
    send({ok:true});return;
  }
  if (path === "/users/wrapped") {
    const year=Number(url.searchParams.get("year"));
    const annualPlans=state.plans.map(p=>yearPlanStats(p.id,p.progress,year));
    const friendPlans=state.externalProfile.plans.map(p=>yearPlanStats(p.id,p.progress,year));
    const score=(person:any,entries:{datetime:string}[],plans:ReturnType<typeof yearPlanStats>[])=>({id:person.id,username:person.username,name:person.name,picture:person.picture,totalActivitiesLogged:entries.filter(e=>inYear(e.datetime,year)).length,totalPoints:entries.filter(e=>inYear(e.datetime,year)).length+plans.filter(p=>p.habitEarned).length*25+plans.filter(p=>p.lifestyleEarned).length*100,bestStreak:Math.max(0,...plans.map(p=>p.peakStreak))});
    send({year,timezone:"UTC",plans:annualPlans,people:[score(state.user,state.entries,annualPlans),...(wrappedFriendEntries.length?[score(state.externalProfile,wrappedFriendEntries,friendPlans)]:[])]});return;
  }
  if (path === "/__profile-design") {
    Object.assign(state.user, { themeBaseColor: "AMBER", accountStats: { totalPoints: 600, totalActivitiesLogged: 325, habitCount: body.empty ? 0 : 3, lifestyleCount: body.empty ? 0 : 2, habitBonus: 75, lifestyleBonus: 200 } });
    const plan = state.plans.find(p => p.id === "fitness");
    if (plan?.progress) Object.assign(plan.progress, { achievement: { streak: body.empty ? 0 : 7 } });
    send({ ok: true }); return;
  }
  if (path === "/__inline-coach") {
    Object.assign(state.user, { themeBaseColor: "AMBER", coachPersonality: "STRATEGIST" });
    state.messages = state.messages.filter(m => m.chatId !== "coach-main");
    state.messages.push({ id: "inline-legacy", chatId: "coach-main", role: "COACH", content: 'Last week, you completed **"💪 train 4 times a week"** on Sunday and Wednesday, finishing 2/4.', planReplacements: [{ textToReplace: "train 4 times a week", plan: { id: "fitness", goal: "Exercise regularly", emoji: "💪" } }], createdAt: now() });
    state.messages.push({ id: "inline-dsl", chatId: "coach-main", role: "COACH", content: "Keep logging {{activity:run|your runs}} and review {{plan:scheduled|your reading plan}}. You felt energetic today. Remember {{plan:removed|your previous goal}}.", planReplacements: [{ textToReplace: "your reading plan", plan: { id: "scheduled", goal: "Read every day", emoji: "📖" } }], metricReplacement: { textToReplace: "energetic", rating: 4, metric: { id: "energy", title: "Energy", emoji: "⚡" } }, createdAt: now() });
    Object.assign(state.messages.at(-1)!, { activityLogProposals: [{ activityId: "run", activityName: "Running", activityEmoji: "🏃", activityMeasure: "kilometers", quantity: 5, date: now(), description: "An easy run", status: null }] });
    const plan = state.plans.find(p => p.id === "scheduled");
    if (plan?.sessions[0]) Object.assign(plan.sessions[0], { descriptiveGuide: "Read ten pages slowly and write down one idea." });
    send({ ok: true }); return;
  }
  if (path === "/__coach-overview") {
    Object.assign(state.user, { themeBaseColor: "AMBER", coachPersonality: "STRATEGIST" });
    state.messages.push({ id: "coach-assessment", chatId: "coach-main", role: "COACH", source: "autonomous_coach", content: "Last week, you completed {{plan:fitness|train 4 times a week}} on Sunday and Wednesday, finishing **2/4**. This week, aim for four sessions on Sunday, Tuesday, Thursday, and Saturday.", createdAt: now() });
    state.messages.push({ id: "coach-assessment-activity", chatId: "coach-main", role: "COACH", source: "autonomous_coach", content: "Keep logging {{activity:run|your runs}} and review {{plan:scheduled|your reading plan}} too.", createdAt: now() });
    send({ ok: true });
    return;
  }
  if (path === "/__achievement") {
    state.achievements.push({
      id: "achievement-test",
      userId: state.user.id,
      user: state.user,
      achievementType: "HABIT",
      message: "My first habit",
      createdAt: now(),
      images: [],
      reactions: [],
      comments: [],
    });
    send({ ok: true });
    return;
  }
  if (path === "/__timeline-design") {
    const image = `http://127.0.0.1:${port}/__background.png`;
    const friend = state.externalProfile;
    if (body.health === true) {
      state.entries = [
        {
          ...state.entries[0],
          id: "health-run",
          quantity: 6,
          source: "apple_health",
          startedAt: "2026-09-08T16:52:00.000Z",
          endedAt: "2026-09-08T17:31:00.000Z",
          datetime: "2026-09-08T17:31:00.000Z",
          distanceMeters: 6_300,
          durationSeconds: 2_340,
        },
      ] as any;
      send({ ok: true });
      return;
    }
    const a = { ...state.entries[0], id: "joint-a", description: "A shared morning outdoors", imageUrls: body.photos === false ? [] : [image, `${image}?2`] };
    const b = { ...state.entries[1], id: "joint-b", userId: friend.id, description: "Sam's chapter after the run", imageUrls: body.photos === false ? [] : [image, `${image}?3`] };
    const deleted = { ...state.entries[0], id: "joint-deleted", deletedAt: now(), imageUrls: [`${image}?deleted`] };
    const members = [
      { user: state.user, activityEntryId: a.id },
      { user: friend, activityEntryId: b.id, activityEntry: { ...b, activity: state.activities[1] } },
      { user: state.user, activityEntryId: deleted.id, activityEntry: deleted },
    ];
    const sharedActivityEntry = { sharedActivity: { entries: members } };
    state.entries = [
      { ...a, sharedActivityEntry, reactions: [{ emoji: "🔥", user: friend }], comments: [{ id: "comment-joint", text: "Great morning!", user: friend }] },
      { ...b, sharedActivityEntry, reactions: [{ emoji: "🔥", user: friend }], comments: [{ id: "comment-joint", text: "Great morning!", user: friend }] },
      deleted,
    ] as any;
    send({ ok: true });
    return;
  }
  if (path === "/__entry-photos") {
    const image = `http://127.0.0.1:${port}/__background.png`;
    state.entries = state.entries.map((entry: any) =>
      entry.id === "entry-run"
        ? {
            ...entry,
            imageUrls: [`${image}?array`],
            imageUrl: `${image}?legacy`,
          }
        : entry,
    ) as any;
    send({ ok: true });
    return;
  }
  if (path === "/__reaction-people") {
    const friend = state.externalProfile;
    state.user.themeBaseColor = "AMBER";
    const reactions = [
      { emoji: "🔥", userId: friend.id, user: { username: friend.username, name: friend.name, picture: `http://127.0.0.1:${port}/__background.png` } },
      { emoji: "♥️", userId: state.user.id, user: state.user },
      { emoji: "🚀", userId: friend.id, user: { username: friend.username, name: friend.name, picture: `http://127.0.0.1:${port}/__background.png` } },
      ...(body.many ? Array.from({ length: 10 }, (_, i) => ({ emoji: "🔥", userId: `reactor-${i}`, user: { id: `reactor-${i}`, name: `Person ${i}`, username: `person${i}` } })) : []),
    ];
    if (body.kind === "own" || body.kind === "external") {
      const original = state.entries.find((entry: any) => entry.id === (body.kind === "own" ? "joint-a" : "joint-b"))!;
      state.entries = [{ ...original, sharedActivityEntry: undefined, reactions, ...(body.photos === false ? { imageUrls: [] } : {}) }] as any;
    } else {
      state.entries = state.entries.map((entry: any) => ({ ...entry, reactions }));
    }
    send({ ok: true });
    return;
  }
  if (req.headers.authorization !== "Bearer local-e2e-token") {
    send({ error: "Unauthorized" }, 401);
    return;
  }
  requests.push({ method: req.method!, path, body });
  if (offlineMode) { req.socket.destroy(); return; }
  if (failNext === path) {
    failNext = undefined;
    send({ error: "Simulated network failure. Please try again." }, 503);
    return;
  }
  const health = healthFixture(path, req.method!, body);
  if (health !== undefined) { send(health); return; }
  const followThrough = followThroughFixture(path, req.method!, body, state);
  if (followThrough !== undefined) { send(followThrough); return; }
  if (path === "/ai/transcribe" && req.method === "POST") {
    send({ text: "I will practise three times a week.", success: true });
    return;
  }
  if (path === "/voice-logs/preview" && req.method === "POST") {
    const date = new Date().toISOString().slice(0, 10);
    send({
      clientRequestId: body.client_request_id,
      transcript:
        "Today was a bit of a mess, honestly. I got out for a run this morning, maybe around five kilometres, and it felt better than I expected. Work was stressful and I was pretty scattered, but after dinner I picked up the guitar for a while, which was nice. I want to play guitar more regularly, maybe most days, for the next couple of months, although I’m not sure I’ll actually keep it up. I’m feeling pretty tired now, but at least I did a few things instead of completely wasting the day.",
      activities: [
        {
          activityId: "run",
          title: "Running",
          emoji: "🏃",
          measure: "kilometers",
          quantity: 5,
          date,
          time: null,
          description: "A morning run",
          privateNotes: null,
          difficulty: null,
          confidence: 0.98,
        },
        {
          activityId: "guitar",
          title: "Guitar",
          emoji: "🎸",
          measure: "minutes",
          quantity: 40,
          date,
          time: null,
          description: null,
          privateNotes: null,
          difficulty: null,
          confidence: 0.92,
        },
      ],
      metrics: [
        {
          metricId: "energy",
          title: "Energy",
          emoji: "⚡",
          rating: 5,
          date,
          description: null,
          confidence: 0.95,
        },
      ],
      note: {
        title: "Voice note",
        text: "Today was a bit of a mess, honestly. I got out for a run this morning, maybe around five kilometres, and it felt better than I expected. Work was stressful and I was pretty scattered, but after dinner I picked up the guitar for a while, which was nice. I want to play guitar more regularly, maybe most days, for the next couple of months, although I’m not sure I’ll actually keep it up. I’m feeling pretty tired now, but at least I did a few things instead of completely wasting the day.",
        date,
        confidence: 0.93,
      },
      unresolved: [
        {
          text: "Try a longer route next time",
          reason: "This sounds like a future intention, not a completed log.",
        },
      ],
    });
    return;
  }
  if (path === "/voice-logs/commit" && req.method === "POST") {
    send({
      success: true,
      duplicate: false,
      activityEntryIds: body.activities?.map(() => `entry-${Date.now()}`) ?? [],
      metricEntryIds: body.metrics?.map(() => `metric-${Date.now()}`) ?? [],
      noteId: `note-${Date.now()}`,
    });
    return;
  }
  if (path === "/users/user") {
    if (req.method === "PATCH") Object.assign(state.user, body);
    send(state.user);
    return;
  }
  if (path === "/users/ai-consent") {
    const now = new Date().toISOString();
    if (body.granted) state.user.aiConsentGrantedAt = now;
    else state.user.aiConsentDeclinedAt = now;
    send({
      aiConsentGrantedAt: state.user.aiConsentGrantedAt,
      aiConsentDeclinedAt: state.user.aiConsentDeclinedAt,
    });
    return;
  }
  if (path === "/users/update-timeline-seen") {
    Object.assign(state.user, { lastSeenTimelineAt: body.lastSeenTimelineAt });
    send({ success: true });
    return;
  }
  if (
    path === "/users/get-user" &&
    body.identifiers?.some(
      (identifier: any) =>
        identifier.username === state.externalProfile.username || identifier.id === "friend-user",
    )
  ) {
    send(state.externalProfile);
    return;
  }
  if (path === "/users/get-user") {
    if (peopleSearchOn && !body.identifiers?.some((i:any)=>i.username===state.user.username || i.id===state.user.id)) {send({error:"User not found"},404);return;}
    send({
      ...state.user,
      plans: state.plans,
      activities: state.activities,
      activityEntries: state.entries,
      achievementPosts: [],
    });
    return;
  }
  if (path === "/activities") {
    send(state.activities);
    return;
  }
  if (path === "/activities/activity-entries") {
    send(state.entries);
    return;
  }
  if (path === "/activities/upsert") {
    const existing = state.activities.find((a) => a.id === body.id);
    if (existing) Object.assign(existing, body);
    else
      state.activities.push({
        ...body,
        id: `activity-${Date.now()}`,
        userId: "test-user",
      });
    send(body);
    return;
  }
  if (path === "/activities/log-activity") {
    if (
      !body.iso_date_string ||
      !body.timezone ||
      !Number.isInteger(Number(body.quantity)) ||
      Number(body.quantity) <= 0
    ) {
      send({ error: "Invalid activity contract" }, 400);
      return;
    }
    const receiptId = typeof body.clientRequestId === "string" ? body.clientRequestId : "";
    const prior = receiptId ? logReceipts.get(receiptId) : undefined;
    if (prior) {
      send({ entry: state.entries.find((item) => item.id === prior), sharedActivityCandidates: [] });
      return;
    }
    const entry = {
      id: `entry-${Date.now()}`,
      activityId: body.activityId,
      userId: "test-user",
      datetime: body.iso_date_string,
      quantity: Number(body.quantity),
      createdAt: now(),
      description: body.description,
      privateNotes: body.privateNotes,
      comments: [],
      reactions: [],
    };
    state.entries.push(entry);
    if (receiptId) logReceipts.set(receiptId, entry.id);
    if (loseNextLogResponse) { loseNextLogResponse = false; req.socket.destroy(); return; }
    send({ entry, sharedActivityCandidates: [] });
    return;
  }
  const entryMatch = path.match(
    /^\/activities\/activity-entries\/([^/]+)(.*)$/,
  );
  if (entryMatch) {
    const [, id, suffix] = entryMatch;
    const entry: any = state.entries.find((e) => e.id === id);
    if (!entry) {
      send({ error: "Not found" }, 404);
      return;
    }
    if (suffix === "/photo" && req.method === "PUT") {
      const requestId = typeof body.clientRequestId === "string" ? body.clientRequestId : "";
      if (!requestId || photoReceipts.get(requestId) !== id) {
        if (requestId) photoReceipts.set(requestId, id);
        entry.imageUrls = [...new Set([...(entry.imageUrls ?? []),
          ...(body.uploadedPhotos ?? []).map((_: unknown, index: number) =>
            `http://127.0.0.1:${port}/__background.png?photo=${requestId}-${index}`)])];
      }
      send(entry);
      return;
    }
    if (suffix === "/reflection-reasons" && req.method === "POST") {
      send({ reasons: body.difficulty === "hard" ? ["Low energy", "Poor sleep", "Busy day"] : ["Felt rested", "Good pace"] });
      return;
    }
    if (suffix === "/comments" && req.method === "GET") {
      send({ comments: entry.comments.map((comment: any) => ({ ...comment, userId: comment.userId ?? comment.user.id, user: { username: comment.user.username, name: comment.user.name, picture: comment.user.picture } })) });
      return;
    }
    if (suffix === "" && req.method === "PUT") Object.assign(entry, body);
    if (suffix === "" && req.method === "DELETE")
      state.entries = state.entries.filter((e) => e.id !== id);
    if (suffix === "/modify-reactions") {
      for (const r of body.reactions) {
        entry.reactions = entry.reactions.filter(
          (v: any) => v.emoji !== r.emoji,
        );
        if (r.operation === "add")
          entry.reactions.push({ emoji: r.emoji, user: state.user });
      }
    }
    if (suffix === "/comments" && req.method === "POST")
      entry.comments.push({
        id: `comment-${Date.now()}`,
        text: body.text,
        user: state.user,
      });
    if (suffix.startsWith("/comments/") && req.method === "DELETE")
      entry.comments = entry.comments.filter(
        (c: any) => c.id !== suffix.split("/").pop(),
      );
    send(entry);
    return;
  }
  if (path === "/plans") {
    send(state.plans);
    return;
  }
  if (path === "/plans/upload-background-image") {
    if (!(body.image instanceof Blob)) {
      send({ error: "Image required" }, 400);
      return;
    }
    body.image = {
      name: body.image.name,
      type: body.image.type,
      size: body.image.size,
    };
    send({ success: true, url: `http://127.0.0.1:${port}/__background.png` });
    return;
  }
  if (path === "/plans/upsert") {
    const existing = state.plans.find((p) => p.id === body.id);
    if (body.milestones)
      body.milestones = body.milestones.map((m: any, i: number) => ({
        ...m,
        id: `milestone-new-${i}`,
        progress: 0,
      }));
    if (existing) Object.assign(existing, body);
    else
      state.plans.push({
        ...body,
        id: `plan-${Date.now()}`,
        createdAt: now(),
        progress: { weeks: [] },
      });
    send({ success: true, plan: existing ?? state.plans.at(-1) });
    return;
  }
  if (path === "/plans/bulk-update" && req.method === "PATCH") {
    for (const update of body.updates) {
      const plan = state.plans.find((p) => p.id === update.planId);
      if (!plan) {
        send({ error: "Not authorized" }, 403);
        return;
      }
      Object.assign(plan, update.updates);
    }
    send({ success: true });
    return;
  }
  const milestoneMatch = path.match(/^\/plans\/milestones\/([^/]+)\/modify$/);
  if (milestoneMatch) {
    const milestone = state.plans
      .flatMap((p) => p.milestones ?? [])
      .find((m) => m.id === milestoneMatch[1]);
    if (!milestone) {
      send({ error: "Not found" }, 404);
      return;
    }
    milestone.progress = Math.max(
      0,
      Math.min(100, milestone.progress + body.delta),
    );
    send({ success: true, milestone });
    return;
  }
  const planMatch = path.match(/^\/plans\/([^/]+)(?:\/(.*))?$/);
  if (planMatch) {
    const [, id, operation] = planMatch;
    const plan: any = [...state.plans, ...state.externalProfile.plans].find(
      (p) => p.id === id,
    );
    if (!plan) {
      send({ error: "Not found" }, 404);
      return;
    }
    if (req.method === "DELETE")
      state.plans = state.plans.filter((p) => p.id !== id);
    if (operation === "pause") {
      plan.isPaused = true;
      plan.pauseReason = body.reason;
    }
    if (operation === "resume") plan.isPaused = false;
    if (operation === "archive") plan.archivedAt = now();
    if (operation === "unarchive") plan.archivedAt = null;
    send(plan);
    return;
  }
  if (path === "/metrics") {
    if (req.method === "POST") {
      const metric = { ...body, id: `metric-type-${Date.now()}` };
      state.metrics.push(metric);
      send(metric);
    } else send(state.metrics);
    return;
  }
  if (path === "/context-events") {
    send({ events: [] });
    return;
  }
  if (path === "/metrics/entries/today-note" && req.method === "PATCH") {
    for (const entry of state.metricEntries)
      if (entry.createdAt.slice(0, 10) === now().slice(0, 10))
        Object.assign(entry, {
          description: body.note,
          descriptionSkipped: body.skip,
        });
    send({ count: 1 });
    return;
  }
  if (path === "/metrics/entries") {
    if (req.method === "POST") {
      const entry = {
        ...body,
        id: `rating-${Date.now()}`,
        createdAt: body.date ?? now(),
      };
      state.metricEntries.push(entry);
      send(entry);
    } else send(state.metricEntries);
    return;
  }
  if (path.startsWith("/metrics/") && req.method === "DELETE") {
    const id = path.split("/").pop();
    state.metrics = state.metrics.filter((m) => m.id !== id);
    state.metricEntries = state.metricEntries.filter((m) => m.metricId !== id);
    send({ ok: true });
    return;
  }
  if (path === "/users/timeline") {
    const cursor = url.searchParams.get("cursor");
    send({
      recommendedActivityEntries: cursor ? [] : state.entries,
      recommendedActivities: state.activities,
      recommendedUsers: [state.user, state.externalProfile],
      achievementPosts: state.achievements,
      nextCursor: cursor ? null : "page-2",
    });
    return;
  }
  if (path.startsWith("/achievements/achievement-test/comments")) {
    const post = state.achievements[0];
    if (!post) { send({ error: "Not found" }, 404); return; }
    if (req.method === "POST") post.comments.push({ id: `post-comment-${Date.now()}`, userId: state.user.id, text: body.text, createdAt: now(), user: { username: state.user.username, name: state.user.name } });
    if (req.method === "DELETE") post.comments = post.comments.filter((comment: any) => comment.id !== path.split("/").pop());
    send({ comments: post.comments });
    return;
  }
  if (path === "/achievements/achievement-test") {
    if (req.method === "PATCH")
      Object.assign(state.achievements[0], { message: body.message });
    if (req.method === "DELETE") state.achievements = [];
    send({ achievementPost: state.achievements[0] });
    return;
  }
  if (path === "/notifications") {
    send(state.notifications);
    return;
  }
  if (path === "/notifications/mark-notification-opened" && req.method === "POST") {
    const notification = state.notifications.find((item) => item.id === url.searchParams.get("notification_id"));
    if (notification) notification.status = "OPENED";
    send(notification || { error: "Not found" }, notification ? 200 : 404);
    return;
  }
  if (path === "/coaches") { send([]); return; }
  if (path.startsWith("/users/search-users/")) {
    const candidates: SearchCandidate[]=peopleSearchOn?[{userId:"friend-user",name:"Lia Borges",username:"liocas",activityCount:2,lastActivityAt:"2026-09-15T08:00:00Z"},{userId:"barbara",name:"Bárbara Herbert",username:"barbara",activityCount:12,lastActivityAt:"2026-09-14T08:00:00Z"}]:[{userId:"sam",name:"Sam",username:"sam",activityCount:0,lastActivityAt:null}];
    send(rankPeople(candidates,decodeURIComponent(path.slice("/users/search-users/".length))));return;
  }
  if (path === "/ai/coach/attention") { send({ attentionItems: [] }); return; }
  if (path === "/ai/coach/chats") {
    const chat = { id: `coach-${Date.now()}`, type: "COACH" as const, title: null, createdAt: now(), updatedAt: now() };
    state.chats.push(chat); send({ chat }); return;
  }
  if (path === "/chats/direct") { send({ chat: state.chats.find(c => c.id === "direct-sam") }); return; }
  if (path === "/ai/coach/history" && req.method === "DELETE") { state.messages = state.messages.filter(m => m.chatId === "direct-sam"); state.chats = state.chats.filter(c => c.type !== "COACH"); send({ success: true }); return; }
  if (path === "/ai/coach/run-assessment") { send({ result: { action: "agent_skipped" } }); return; }
  const chatMatch = path.match(/^\/chats\/([^/]+)\/(.*)$/);
  if (chatMatch) {
    const [,chatId,suffix] = chatMatch;
    if (suffix === "coach-response-status") { send({ status: null }); return; }
    if (suffix === "messages/mark-read") { state.messages.forEach(m => { if (m.chatId === chatId && body.messageIds.includes(m.id)) m.status = "READ"; }); send({ success: true }); return; }
    if (suffix === "messages" && req.method === "GET") {
      send({ messages: state.messages.filter(m => m.chatId === chatId || (url.searchParams.get("includeCoachHistory") === "true" && m.chatId?.startsWith("coach-"))) }); return;
    }
    if (req.method === "POST" && suffix.startsWith("messages")) {
      const rewrite = suffix.match(/^messages\/([^/]+)\/rewrite\/stream$/);
      const userMessage = { id: rewrite?.[1] || `user-${Date.now()}`, chatId, role: "USER" as const, senderId: "test-user", content: body.message, imageAttachments: body.imageAttachments, createdAt: now() };
      if (rewrite) state.messages = state.messages.filter(m => m.id !== rewrite[1]);
      state.messages.push(userMessage);
      if (suffix.endsWith("/stream")) {
        if (body.coachVersion !== "v2") { send({ error: "v2 required" },400); return; }
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
        res.write('event: status\ndata: {"state":"thinking"}\n\n');
        setTimeout(() => {
          const reply = { id: `reply-${Date.now()}`, chatId, role: "COACH" as const, content: "That sounds good. Keep the next run comfortable.", status: "SENT" as const, createdAt: now() };
          state.messages.push(reply);
          res.end(`event: done\ndata: ${JSON.stringify({ messages: [userMessage,reply] })}\n\n`);
        },800); return;
      }
      send({ messages: [userMessage] }); return;
    }
  }
  const feedbackMatch = path.match(/^\/ai\/coach\/messages\/([^/]+)\/feedback$/);
  if (feedbackMatch) { const message = state.messages.find(m => m.id === feedbackMatch[1]); if (message) message.feedback = { metadata: { feedbackType: body.feedbackType } }; send({ feedback: message?.feedback }); return; }
  const metricMatch = path.match(/^\/ai\/messages\/([^/]+)\/(accept|reject)-metric$/);
  if (metricMatch) {
    const message = state.messages.find(m => m.id === metricMatch[1]);
    if (message?.metricReplacement) message.metricReplacement.status = metricMatch[2] === "accept" ? "accepted" : "rejected";
    send({ success: true }); return;
  }
  const proposalMatch = path.match(/^\/ai\/messages\/([^/]+)\/(accept|reject)-activity-log-proposal$/);
  if (proposalMatch) { const message = state.messages.find(m => m.id === proposalMatch[1]); const proposal = message?.activityLogProposals?.[body.proposalIndex]; if (proposal) proposal.status = proposalMatch[2] === "accept" ? "accepted" : "rejected"; send({ success: true }); return; }
  if (path === "/chats") {
    send({ chats: state.chats });
    return;
  }
  if (path === "/users/rankings") {
    send({
      pointsRanking: [
        {
          rank: 1,
          username: "alex",
          name: "Alex",
          totalPoints: 16,
          bestStreak: 3,
        },
      ],
      streaksRanking: [],
      currentUser: {
        pointsRank: 1,
        streaksRank: null,
        totalPoints: 16,
        bestStreak: 3,
      },
    });
    return;
  }
  send({ error: `Unhandled fixture route: ${req.method} ${path}` }, 404);
});
server.listen(port, "127.0.0.1", () =>
  process.stdout.write(`Fixture API listening on ${port}\n`),
);
