/**
 * Chat coach cases. The coach should not be agreeable: it says what a good coach would, and defers to the
 * person where they know better (the course or book they follow, what they already did).
 * Every message below was really sent to the coach (Oct–Nov 2026); the conversation
 * before it is what the coach had at that moment, shortened. Expectations say what the person would
 * notice, never how the coach should do it.
 */

export type Turn = { role: "user" | "assistant"; content: string };

export type Entry = { activity: string; daysAgo: number; quantity: number; note?: string };

export type PlanFixture = {
  id: string;
  goal: string;
  goalReason?: string;
  outlineType: "SPECIFIC" | "TIMES_PER_WEEK";
  timesPerWeek?: number;
  finishingDate?: string;
  notes?: string;
  activities: { title: string; measure: string }[];
  /** Upcoming sessions, by days from today (negative = past). */
  sessions?: { inDays: number; activity: string; quantity: number; guide: string }[];
};

export type Case = {
  id: string;
  /** One line for the judge: who this is and what is going on. */
  situation: string;
  name: string;
  plans: PlanFixture[];
  entries?: Entry[];
  history: Turn[];
  message: string;
  /** What the person would notice. The judge checks each one. */
  expect: string[];
  /** A longer answer is fine (they asked for one). */
  long?: boolean;
};

const training: PlanFixture = {
  id: "plan-training",
  goal: "train 4 times a week",
  outlineType: "TIMES_PER_WEEK",
  timesPerWeek: 4,
  activities: [
    { title: "gym", measure: "sessions" },
    { title: "running", measure: "kilometers" },
    { title: "bouldering", measure: "sessions" },
    { title: "Yoga", measure: "minutes" },
  ],
};

// The owner's real plan, as it was on 21–24 Nov 2026.
const chinese: PlanFixture = {
  id: "plan-chinese",
  goal: "Conversational Chinese",
  goalReason: "I'm probably going to China, and I would like to be conversational in Chinese.",
  outlineType: "SPECIFIC",
  timesPerWeek: 7,
  finishingDate: "2027-08-23",
  notes: "What can you say in Chinese now? Cannot say anything, just basic nihao and my name.",
  activities: [{ title: "Chinese practice", measure: "minutes" }],
  sessions: [
    { inDays: -4, activity: "Chinese practice", quantity: 20, guide: "Learn the four Mandarin tones; say hello, goodbye, thank you and your name 5 times each." },
    { inDays: -2, activity: "Chinese practice", quantity: 25, guide: "Build a 4-sentence self-introduction: name, where you are from, a greeting, and a pleasantry." },
    { inDays: 0, activity: "Chinese practice", quantity: 25, guide: "Learn please, sorry, excuse me, no problem, and I do not understand. Say each 5 times." },
    { inDays: 1, activity: "Chinese practice", quantity: 15, guide: "Easy day: go through every phrase and number learned so far once, aloud." },
    { inDays: 2, activity: "Chinese practice", quantity: 30, guide: "Learn how numbers 11 to 100 are built from 1-10. Count by tens." },
    { inDays: 3, activity: "Chinese practice", quantity: 30, guide: "Learn 5 question words and ask simple questions such as what is this." },
    { inDays: 5, activity: "Chinese practice", quantity: 30, guide: "Learn 10 words for family and people. Make 5 short sentences." },
  ],
};

const chineseLogs: Entry[] = [
  { activity: "Chinese practice", daysAgo: 4, quantity: 20 },
  { activity: "Chinese practice", daysAgo: 2, quantity: 25 },
  { activity: "Chinese practice", daysAgo: 1, quantity: 30 },
];

const coachAskedForLink: Turn[] = [
  { role: "assistant", content: "You've got a useful start with greetings and goodbyes. Next, finish the planned self-introduction so you can move forward with a complete set of basics." },
  { role: "user", content: "I already did greetings and goodbyes. Self introduction, I already did that." },
  { role: "assistant", content: "Got it, Alex. Greetings, goodbyes, and your self-introduction are already covered, so don't repeat them. The next useful step is please, sorry, excuse me, no problem, and \"I don't understand\"." },
  { role: "user", content: "I'm actually following Coursera's guide from Peking University." },
  { role: "assistant", content: "That makes sense, Alex. We should follow the Peking University Coursera sequence instead of the improvised phrase order; send me the exact course link or title, and I'll align Conversational Chinese to it." },
];

export const cases: Case[] = [
  {
    id: "hsk-deadline",
    situation: "Alex is learning Chinese with the Peking University course on Coursera (told the coach 3 days ago). They looked into it and set a target.",
    name: "Alex",
    plans: [chinese],
    entries: chineseLogs,
    history: coachAskedForLink,
    message: "was investigating, and i want to reach hsk4 till march 1, which means 12 new words per day!",
    // Pushing back is fine: a good coach says what it thinks. It still has to move things forward.
    expect: [
      "Gives its honest view of the target (agreeing or pushing back with a reason); not empty praise.",
      "Moves forward on the course they follow: a plan change card or exactly what changes, not only a question back.",
    ],
  },
  {
    id: "course-said-twice",
    situation: "Alex is learning Chinese. The coach asked for the course link; Alex sends the same sentence again instead of a link.",
    name: "Alex",
    plans: [chinese],
    entries: chineseLogs,
    history: coachAskedForLink,
    message: "I'm actually following Coursera's guide from Peking University.",
    expect: [
      "Does not ask for the link or the course title again; finds the course itself.",
      "Lines their plan up with that course (a plan change card or the course's next concrete lesson), not the improvised phrase order.",
    ],
  },
  {
    id: "already-did-that",
    situation: "Alex is learning Chinese. The coach just suggested doing what Alex had already done.",
    name: "Alex",
    plans: [chinese],
    entries: chineseLogs,
    history: [coachAskedForLink[0]],
    message: "I already did greetings and goodbyes. Self introduction, I already did that.",
    expect: [
      "Believes them and does not suggest greetings, goodbyes or the self-introduction again.",
      "Moves them on to what comes next.",
    ],
  },
  {
    id: "lost-motivation",
    situation: "Alex trains 4 times a week and logged a session yesterday. Saturday morning, they open the chat.",
    name: "Alex",
    plans: [training],
    entries: [
      { activity: "gym", daysAgo: 1, quantity: 1 },
      { activity: "running", daysAgo: 4, quantity: 5 },
      { activity: "gym", daysAgo: 6, quantity: 1 },
      { activity: "running", daysAgo: 8, quantity: 8 },
    ],
    history: [],
    message: "I lost motivation.",
    expect: [
      "Short and human: no lecture and no list of tips.",
      "Helps them toward the next small step, or asks the one thing that would (like the smallest session they'd still do).",
      "Does not suggest changing the plan or its weekly target (a smaller session today is fine).",
    ],
  },
  {
    id: "one-word-answer",
    situation: "Alex trains 4 times a week. They said they lost motivation; the coach asked when the next session is.",
    name: "Alex",
    plans: [training],
    entries: [
      { activity: "gym", daysAgo: 1, quantity: 1 },
      { activity: "running", daysAgo: 4, quantity: 5 },
    ],
    history: [
      { role: "user", content: "I lost motivation." },
      { role: "assistant", content: "Motivation dipped after yesterday's session. When is your next session?" },
    ],
    message: "Today.",
    expect: [
      "Does not just say their answer back (like \"Your next session is today.\").",
      "Gives them something to hold on to (a time, the smallest version of the session, or that the coach will check in) in a line or two.",
    ],
  },
  {
    id: "back-but-busy",
    situation: "Alex trains 4 times a week and has been travelling, nothing logged for 6 days.",
    name: "Alex",
    plans: [training],
    entries: [
      { activity: "running", daysAgo: 6, quantity: 6 },
      { activity: "gym", daysAgo: 8, quantity: 1 },
    ],
    history: [
      { role: "user", content: "I'm travelling." },
      { role: "assistant", content: "Travel can interrupt the rhythm. When are you back?" },
    ],
    message: "Just got back today But I need to work.",
    expect: [
      "No pressure to train today; accepts that work comes first.",
      "Does not propose changing the plan or the weekly target.",
    ],
  },
  {
    id: "missed-week-again",
    situation: "Alex trains 4 times a week. They travelled two weeks running and logged nothing for 9 days. They asked the same thing a week ago.",
    name: "Alex",
    plans: [training],
    entries: [
      { activity: "running", daysAgo: 9, quantity: 7 },
      { activity: "gym", daysAgo: 11, quantity: 1 },
      { activity: "gym", daysAgo: 13, quantity: 1 },
    ],
    history: [
      { role: "user", content: "I missed \"train 4 times a week\" last week. I was travelling. Can you help me make this week work?" },
      { role: "assistant", content: "Travel explains last week, Alex. This week is still recoverable, so don't compensate with hard sessions; use the easiest available training option each day and protect a steady rhythm." },
    ],
    message: "I missed \"train 4 times a week\" last week. I was travelling. Can you help me make this week work?",
    expect: [
      "Gives a concrete way to get this week done (which days, or the minimum that counts), not general advice.",
      "Does not pile on extra or harder sessions to make up for last week.",
    ],
  },
  {
    id: "quiz-in-german",
    situation: "Mia is learning German and asked the coach to quiz her. They have done a few rounds.",
    name: "Mia",
    plans: [{ id: "plan-german", goal: "Learn German", outlineType: "TIMES_PER_WEEK", timesPerWeek: 5, activities: [{ title: "German practice", measure: "minutes" }] }],
    entries: [{ activity: "German practice", daysAgo: 1, quantity: 20 }],
    history: [
      { role: "user", content: "Can you ask me a question in german to test me?" },
      { role: "assistant", content: "Sure, Mia! Wie heißt die Hauptstadt von Deutschland? (What's the capital of Germany?)" },
      { role: "user", content: "Berlin" },
      { role: "assistant", content: "Spot on, Mia, Berlin is exactly right! Want another question?" },
    ],
    message: "Yes ask me another question but don’t translate the question to english because then it’s too easy",
    expect: [
      "Asks one new question in German with no English translation.",
      "Stays in the quiz: no plan, streak or schedule talk.",
    ],
  },
  {
    id: "first-walk",
    situation: "A new person who set up a walking plan two days ago. They just logged their first walk.",
    name: "Sam",
    plans: [{ id: "plan-walk", goal: "Walk 3 times a week", outlineType: "TIMES_PER_WEEK", timesPerWeek: 3, activities: [{ title: "walking", measure: "minutes" }] }],
    entries: [{ activity: "walking", daysAgo: 0, quantity: 20 }],
    history: [],
    message: "I completed my first walk and would like a next step.",
    expect: [
      "Gives one concrete next step (when and how much), sized for a beginner.",
      "Does not redesign the plan or hand them a programme.",
    ],
  },
];
