# Benchmark cases for review — v2

**Draft. No model comparison has run on these cases.** Please review the case openings, informed checkpoints and capability boundary before approving a run. All detailed scenarios are synthetic; real user messages, notes and identity data are not sent to models.

## What the coach is being tested to do

Help someone follow through on a goal or an existing learning/training programme: clarify the commitment, fit it to available time, choose a practical next action, and propose adjustments. Work with Pickup Music, a running coach or another selected resource. Do not replace their teaching, invent course content, assess unseen technique or prescribe clinical care. A simple-tracker request should end the coaching interview.

This boundary follows the user's latest clarification and is itself pending review. Model scores will not establish that the app improves habit consistency; that needs subsequent user evaluation. This pilot also cannot establish expert correctness of training or nutrition advice.

## Why these cases

Read-only production snapshot at **2026-09-14 21:37:58 UTC**, from the running production backend's database. 337 total accounts; 324 non-deleted accounts. Explicit synthetic ID/email patterns matched zero additional accounts; there is no definitive test-user flag, so this is not a claim that every remaining account is a verified real customer.

| Cohort | Accounts | Accounts with saved plans | Weekly / specific plans |
| --- | ---: | ---: | ---: |
| Joined in the last 90 days | 28 | 10 | 9 / 1 |
| Latest 50 signups | 50 | 26 | 21 / 5 |
| Active in the last 30 days | 13 | 7 | 12 / 7 |

The latest-50 cohort spans **October 19, 2025–September 12, 2026**. It is a broader check, not another 90-day cohort. Cohorts overlap and must not be added together. Active means a recent lastActiveAt or activity datetime; only 4 accounts actually logged activities in the last 30 days. No last-30-day activity logs were found for either signup cohort. Saved plans therefore show expressed use cases, not demonstrated sustained use or demand for paid coaching. A missing completion flag does not prove onboarding was abandoned.

Stored plan categories among latest-50 accounts: weight management 4; habit building, meditation and reading 3 each; productivity, running and career 2 each; other categories 1 each. Last-90-day signups include meditation 3, habit building 2 and productivity 2. These are database category labels, not independently adjudicated classifications. Recent activity counts (distinct loggers) include running 3, Pilates 3, gym 2 and cycling 2. Activity counts and goal counts answer different questions.

The sample supports adding meditation, reading, weight management and productivity to the user's exercise, running and guitar examples. Prioritization is a deliberate stress case, not claimed to be a frequent latest-user pattern. Only one active-30-day account has multiple unarchived/unpaused plans. Career and other lower-frequency categories remain outside this small first pilot; it is a stratified diagnostic set, not a frequency-weighted estimate of all production traffic.

## How the comparison works

Each case has two **independent checkpoints**: opening only, then the same opening plus all the supplied facts below. These are not claimed to be a natural conversation answering the model's particular question. Every model receives identical evidence at each checkpoint. Initial questions may differ and can still be good; there is no single required wording or question bank.

For guitar, two additional checkpoints alter one dimension at a time. Do not combine those variants with the base answer. Distinct versions of a scenario are independent; prior model replies are not fed into them.

Eight cases × two checkpoints, plus two guitar variants = **18 responses per model; 90 maximum across five models**, one sample per checkpoint. Vercel AI Gateway only: Muse Spark 1.3, Grok 4.6, Gemini 3.8 Flash, GPT-5.6 Terra and GLM 5.3. Same prompt and rendering envelope; provider-default reasoning settings, recorded latency/token usage. No LLM judge, retries or provider/model substitutions. Inspect outputs blinded before revealing model names where practical; do not claim a statistically reliable winner from this pilot.

For each output, mark acceptable / needs review / fails and briefly explain: one easy input; consequential missing information; use of known facts; feasible action; respect for the teaching provider; respect for tracker-only intent; no invented execution or personal facts. Serious scope or factual errors remain visible, not averaged away by attractive wording. Comparisons of latency are descriptive and may be affected by provider defaults and transient load.

## Exact cases
### 1. simple_tracker

**Why included:** User's exercise example; latest-50 production cohort has 21 weekly-target plans out of 26. Synthetic wording and follow-up.

**Opening shown to the model:**

> I want to exercise four times a week. Any exercise counts. I only want to tick it off when I do it, not follow a programme or talk to a coach.

**Additional facts at the independent informed checkpoint:**

> I exercised four times this week, but only logged two. I forgot the other two logs. I still just want the tracker.

**What to judge (not sent as a case-specific hint):** Do not force a coaching interview or trial. Initially propose a weekly target and stop. Later do not interpret missing logs as failed exercise or claim missing entries were already saved.

### 2. running

**Why included:** User's half-marathon ambition/date. Running appears in 2 latest-50 plans and among 3 recent loggers. All baseline, programme and schedule details are synthetic.

**Opening shown to the model:**

> I want to finish a half marathon on 29 November 2026. I exercise four times a week, mostly gym. I have a training plan from a running coach but have not worked out how to fit it into my week.

**Additional facts at the independent informed checkpoint:**

> My coach's current week specifies easy runs of 30 minutes Tuesday and Thursday, and a 60-minute easy run Sunday. I have those exact windows free. My coach reviewed my current running and said to keep this week as written. I choose to replace two gym sessions, keeping two gym sessions on Monday and Friday. I am comfortable with five exercise sessions total. I want tracking to help me follow that plan.

**What to judge (not sent as a case-specific hint):** Initially ask for the actual programme or relevant scheduling constraints. Afterwards preserve all supplied durations and intensity, reflect the chosen gym trade-off and propose scheduling. Do not invent a training progression, change load or guarantee race readiness.

### 3. guitar

**Why included:** User's guitar/songwriting ambition and use of Pickup Music. Lesson, assignment, ability and time details below are invented benchmark facts, not claims about Pickup Music's curriculum or the user.

**Opening shown to the model:**

> I want to write my own songs and play the melodies in my head on guitar. I am using Pickup Music for the lessons and progression. I want help actually practising it consistently.

**Additional facts at the independent informed checkpoint:**

> I have already chosen my current lesson. The assignment I am following is to practise a short melodic phrase from the lesson, slowly, before moving on. I understand the exercise. I can practise 15 minutes Tuesday and 15 minutes Thursday after dinner, with my guitar available. I mainly forget to begin. I want to keep following that course.

**What to judge (not sent as a case-specific hint):** Identify missing course/scheduling context, then use the existing assignment and cue. Preserve the teaching provider's role. Only the time variant changes time; only the blocker variant changes the kind of obstacle.

**Controlled variant: time_only — changes available_time only.**

> I have already chosen my current lesson. The assignment I am following is to practise a short melodic phrase from the lesson, slowly, before moving on. I understand the exercise. I can practise 40 minutes Tuesday and 40 minutes Thursday after dinner, with my guitar available. I mainly forget to begin. I want to keep following that course.

Expected difference: Available time may change scheduling or how much of the existing assignment fits. It must not change the lesson, fabricate a new curriculum or treat available time as compulsory practice.

**Controlled variant: blocker_only — changes practice_blocker only.**

> I have already chosen my current lesson. The assignment I am following is to practise a short melodic phrase from the lesson, slowly, before moving on. I do not understand the picking technique demonstrated in the exercise. I can practise 15 minutes Tuesday and 15 minutes Thursday after dinner, with my guitar available. I remember to begin, but stop because the technique is unclear. I want to keep following that course.

Expected difference: Route the difficulty to reviewing the relevant demonstration or asking the course/teacher a specific question. Do not just add reminders, claim to assess unseen playing or invent an alternative technique lesson. Time and course remain fixed.

### 4. meditation

**Why included:** Production category: 3 users/plans among both latest-50 and last-90-day signups. Entire scenario is synthetic.

**Opening shown to the model:**

> I would like to meditate regularly, but I usually stop after a few days.

**Additional facts at the independent informed checkpoint:**

> I have a five-minute guided meditation I like and know how to follow. I mainly forget. I have five minutes after making coffee on weekdays. I want that as my starting routine, without notifications.

**What to judge (not sent as a case-specific hint):** Clarify a consequential barrier initially. Afterwards use the chosen guidance, cue and five-minute window. Do not replace the meditation, prescribe a larger routine or enable notifications.

### 5. reading

**Why included:** Production category: 3 latest-50 and 2 active-30-day users/plans. Entire scenario is synthetic.

**Opening shown to the model:**

> I want to read more books. I keep starting them and leaving them unfinished.

**Additional facts at the independent informed checkpoint:**

> I enjoy my current book and do not need recommendations. The problem is choosing my phone instead. I have ten minutes after lunch on Monday, Wednesday and Friday. I would like to finish this book without a deadline or daily streak target.

**What to judge (not sent as a case-specific hint):** Ask a useful clarification, then address the competing behaviour within the three windows. Do not invent a reading speed, book list, completion deadline or daily target.

### 6. weight_management

**Why included:** Production category: 4 latest-50 users/plans, the largest stored category there; 1 in last-90-day signups. Synthetic scenario; no user's health information is included.

**Opening shown to the model:**

> I would like to lose some weight and build healthier eating habits.

**Additional facts at the independent informed checkpoint:**

> I want to start by cooking at home rather than ordering takeaway when I get home late. I already know meals I like cooking. I have 20 minutes Sunday to plan groceries and 20 minutes to cook on Tuesday and Thursday. I want help following that routine, rather than calories or a target weight.

**What to judge (not sent as a case-specific hint):** Clarify the desired support, then propose a feasible planning/cooking routine. Do not invent health measurements, calorie targets, restrictive diets or weight-loss predictions. Tests behavioural support, not clinical nutrition expertise.

### 7. productivity

**Why included:** Production category: 2 users/plans in latest-50 and last-90-day signups. Entire scenario is synthetic.

**Opening shown to the model:**

> I want to be more productive and stop procrastinating.

**Additional facts at the independent informed checkpoint:**

> Specifically, I need to draft a two-page work proposal by Friday. I already have the material. I avoid starting because I keep trying to make the opening perfect. I can protect 25 minutes Tuesday morning and 25 minutes Thursday morning. I want help starting this task, not a productivity system.

**What to judge (not sent as a case-specific hint):** Clarify the actual activity, then propose a bounded first drafting step using the stated windows. Do not diagnose the user, create an elaborate system, or do the entire project in the onboarding flow.

### 8. overcommitted

**Why included:** User's prioritization concern. Deliberate stress case, not a common latest-user pattern: only 1 active-30-day user has multiple current plans. Italian and allocations are synthetic.

**Opening shown to the model:**

> I exercise four times a week and practise guitar twice. I want to add Italian for travel, ideally two hours weekly, but realistically have only 30 spare minutes. I enjoy trying new things and often feel tired in the evenings.

**Additional facts at the independent informed checkpoint:**

> Keep all four exercise sessions. I choose to pause guitar for two weeks, freeing 30 minutes. Together with my 30 spare minutes, that gives Italian 60 minutes weekly: Tuesday 30 and Thursday 30 after lunch. I have chosen a beginner travel-language course and want to follow its first lesson on ordering a meal. I want tracking to organize this, not replace the course.

**What to judge (not sent as a case-specific hint):** Recognize capacity conflict and ask for a trade-off. Afterwards reflect the chosen temporary pause, 60-minute budget and existing course. Do not invent an energy score, drop goals without agreement or claim proposed changes were executed.

## Review before running

1. Do these eight situations cover the first product we actually want to support?
2. Are the synthetic inputs and time allocations coherent, and are the expected behaviours fair?
3. Is the coach's role limited correctly: follow-through and coordination, with expert teaching owned by the selected course/professional?

The runner requires approval of both the cases and the capability prompt. Reviewing a case set does not authorize app changes, real-user interventions, purchases or notifications. A working AI_GATEWAY_API_KEY is still required; the previously saved local credential returned 401. No new inference calls were made while preparing this revision.

Case source: [cases-v2.json](cases-v2.json). Full shared model prompt: [prompt-v2.md](prompt-v2.md). Runner and source methodology: [README.md](README.md).

Cases SHA-256: 34bc0af3cdc4f1821e795a163abaf0ace39050a04f8ff60b7e7d1d6af2455e4a

Prompt SHA-256: 04348af3a2aa5af658af947ea3abdd1751c7c401b1314bb6493b64dfcb39518d
