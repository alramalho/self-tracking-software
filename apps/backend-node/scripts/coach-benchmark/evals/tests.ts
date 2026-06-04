import {
  allOf,
  arrayLengthAtLeast,
  jsonPathEquals,
  jsonPathIncludes,
  llmJudge,
  proposalCount,
  responseMatches,
  responseNotMatches,
  toolCalled,
  toolCalledWith,
  toolsNotCalled,
  type CoachEvalTest,
} from "./types";

const ALEX_BASE_USER = {
  email: "coach-bench@example.com",
  username: "alex",
  name: "Alex",
  timezone: "Europe/Sofia",
  coachPersonality: "CHAMPION",
};

function alexUser(id: string) {
  return {
    ...ALEX_BASE_USER,
    id,
    email: `${id}@example.com`,
  };
}

const emptyAlexFixture = (id: string) => ({
  user: alexUser(id),
  plans: [],
  activityEntries: [],
  reminders: [],
  conversationHistory: [],
});

export const existingPlanFinishDateModificationTest: CoachEvalTest = {
  id: "existing_plan_finish_date_modification",
  name: "Existing plan edit uses modification, not duplicate creation",
  userMessage:
    "Can you add an end date to my machine learning plan and make it finish by August 31?",
  fixture: {
    ...emptyAlexFixture("coach-bench-alex-01"),
    plans: [
      {
        id: "bench-plan-ml",
        goal: "Learn machine learning with fast.ai",
        emoji: "🤖",
        outlineType: "SPECIFIC",
        notes:
          "Roadmap: Practical Deep Learning for Coders, work through lessons in order, keep a small project log after each lesson.",
        activities: [
          {
            id: "bench-activity-ml-study",
            title: "ML study",
            measure: "minutes",
            emoji: "🤖",
            kind: "learning",
          },
        ],
        sessions: [
          {
            id: "bench-session-ml-1",
            activityId: "bench-activity-ml-study",
            date: "2026-06-08",
            quantity: 60,
            descriptiveGuide: "Lesson 1 review and notebook setup.",
          },
        ],
        milestones: [],
      },
    ],
  },
  verify: async (ctx) =>
    allOf(
      toolCalled(ctx, "proposePlanModification"),
      toolsNotCalled(ctx, ["proposePlanCreation"]),
      proposalCount(ctx, "planModification", { equals: 1 }),
      jsonPathEquals(
        ctx,
        "planModificationProposal",
        "patch.plan.finishingDate",
        "2026-08-31"
      ),
      responseNotMatches(
        ctx,
        /\b(I('|')?ve|I have)\s+(updated|changed|set)\b/i,
        "does_not_claim_completed_change"
      ),
      await llmJudge(
        ctx,
        "Treats the request as an edit to the exact existing plan, not as a new plan.",
        "Uses the exact plan goal text when referring to the plan.",
        "Does not imply the plan has already changed before the user accepts the proposal."
      )
    ),
};

export const structuredGoalRequiresUserChoiceTest: CoachEvalTest = {
  id: "structured_goal_requires_user_choice",
  name: "Specific progression goal asks structure preference before proposing",
  userMessage:
    "I want to run a half marathon under 2 hours in October. I can train Tuesday, Thursday, and Saturday. Can you make a plan?",
  fixture: emptyAlexFixture("coach-bench-alex-02"),
  verify: async (ctx) =>
    allOf(
      proposalCount(ctx, "planCreation", { equals: 0 }),
      responseMatches(
        ctx,
        /\b(structure|structured|dated sessions|specific)\b/i,
        "asks_about_structure"
      ),
      await llmJudge(
        ctx,
        "Recognizes that a half marathon time goal needs progression and likely belongs in a SPECIFIC plan.",
        "Asks the user explicitly whether they want a structured dated plan before attaching a plan proposal.",
        "Asks at most one natural next-step question."
      )
    ),
};

export const inlineCurriculumSpecificPlanTest: CoachEvalTest = {
  id: "inline_curriculum_specific_plan",
  name: "Inline curriculum becomes notes plus concrete dated sessions",
  userMessage:
    "Let's set up a structured plan for learning TypeScript. Source roadmap: Module 1 types and functions, Module 2 async and APIs, Module 3 React components, Module 4 shipping a small app. I can do 3 sessions a week starting next Monday for 4 weeks.",
  fixture: emptyAlexFixture("coach-bench-alex-03"),
  verify: async (ctx) =>
    allOf(
      proposalCount(ctx, "planCreation", { equals: 1 }),
      jsonPathEquals(ctx, "planCreationProposal", "outlineType", "SPECIFIC"),
      jsonPathIncludes(ctx, "planCreationProposal", "notes", "small app"),
      arrayLengthAtLeast(ctx, "planCreationProposal", "sessions", 3),
      jsonPathIncludes(
        ctx,
        "planCreationProposal",
        "sessions.0.descriptiveGuide",
        "Module"
      ),
      await llmJudge(
        ctx,
        "Preserves the full durable roadmap in plan notes, not only in the chat prose.",
        "Creates useful near-term dated sessions that reference modules or concrete work, not generic study sessions.",
        "Does not repeat every session detail in the visible message when the proposal card carries the plan."
      )
    ),
};

export const multipleTracksOnePlanAtATimeTest: CoachEvalTest = {
  id: "multiple_tracks_one_plan_at_a_time",
  name: "Multiple learning tracks are not bundled into several plan cards",
  userMessage:
    "Can you create plans for both deep learning and robotics? I want to start both this month.",
  fixture: emptyAlexFixture("coach-bench-alex-04"),
  verify: async (ctx) =>
    allOf(
      proposalCount(ctx, "planCreation", { max: 1 }),
      await llmJudge(
        ctx,
        "Does not attach multiple plan creation cards for multiple tracks in the same turn.",
        "Either picks one progressive deep dive to configure first or asks which track to set up first.",
        "Makes clear that the second track can be handled after the first choice or confirmation."
      )
    ),
};

export const legacyActivityRecencyCheckTest: CoachEvalTest = {
  id: "legacy_activity_recency_check",
  name: "Legacy activity is not treated as recent evidence",
  userMessage:
    "Make me a 3x/week strength plan. You can use my gym activity if that still makes sense.",
  fixture: {
    ...emptyAlexFixture("coach-bench-alex-05"),
    plans: [
      {
        id: "bench-plan-old-gym",
        goal: "Get stronger",
        emoji: "🏋️",
        outlineType: "TIMES_PER_WEEK",
        timesPerWeek: 3,
        activities: [
          {
            id: "bench-activity-gym",
            title: "Gym",
            measure: "sessions",
            emoji: "🏋️",
            kind: "strength",
          },
        ],
        sessions: [],
        milestones: [],
      },
    ],
    activityEntries: [
      {
        activityId: "bench-activity-gym",
        datetime: "2025-05-01T08:00:00.000Z",
        quantity: 1,
      },
    ],
  },
  verify: async (ctx) =>
    allOf(
      responseNotMatches(
        ctx,
        /\b(recent|recently|lately)\b[^\n.]{0,60}\bGym\b|\bGym\b[^\n.]{0,60}\b(recent|recently|lately)\b/i,
        "does_not_call_gym_recent"
      ),
      await llmJudge(
        ctx,
        "Does not treat the old Gym activity as recent logged evidence.",
        "If reusing Gym, checks whether that legacy activity still makes sense or clearly frames it as an existing old tracking bucket.",
        "Avoids creating a near-duplicate strength plan without acknowledging the similar active plan."
      )
    ),
};

export const recentActivityEvidenceOnlyTest: CoachEvalTest = {
  id: "recent_activity_evidence_only",
  name: "Plan activity without entries is planned, not recently done",
  userMessage: "Have I been doing chess lately?",
  fixture: {
    ...emptyAlexFixture("coach-bench-alex-06"),
    plans: [
      {
        id: "bench-plan-chess",
        goal: "I want to play chess every day",
        emoji: "♟️",
        outlineType: "TIMES_PER_WEEK",
        timesPerWeek: 7,
        activities: [
          {
            id: "bench-activity-chess",
            title: "Chess",
            measure: "minutes",
            emoji: "♟️",
            kind: "learning",
          },
        ],
        sessions: [],
        milestones: [],
      },
    ],
  },
  verify: async (ctx) =>
    allOf(
      responseNotMatches(
        ctx,
        /\b(you('|')?ve|you have)\s+(been\s+)?(doing|logged|played|practiced)\b/i,
        "does_not_claim_logged_chess"
      ),
      await llmJudge(
        ctx,
        "Distinguishes planned Chess from logged recent Chess activity.",
        "Says there is no recent activity evidence if no entries are available.",
        "Does not invent streaks, counts, or recent completions."
      )
    ),
};

export const activityLogProposalHonestyTest: CoachEvalTest = {
  id: "activity_log_proposal_honesty",
  name: "Activity logging creates a proposal card and avoids completed-action wording",
  userMessage: "I did 30 minutes of chess today.",
  fixture: {
    ...emptyAlexFixture("coach-bench-alex-07"),
    plans: [
      {
        id: "bench-plan-chess-log",
        goal: "I want to play chess every day",
        emoji: "♟️",
        outlineType: "TIMES_PER_WEEK",
        timesPerWeek: 7,
        activities: [
          {
            id: "bench-activity-chess-log",
            title: "Chess",
            measure: "minutes",
            emoji: "♟️",
            kind: "learning",
          },
        ],
        sessions: [],
        milestones: [],
      },
    ],
  },
  verify: async (ctx) =>
    allOf(
      proposalCount(ctx, "activityLog", { equals: 1 }),
      jsonPathEquals(ctx, "activityLogProposal", "quantity", 30),
      responseNotMatches(
        ctx,
        /\b(I('|')?ve|I have)\s+(logged|recorded|saved)\b/i,
        "does_not_claim_logged"
      ),
      await llmJudge(
        ctx,
        "Attaches an activity log proposal for Chess with 30 minutes.",
        "Does not imply the entry was already permanently logged.",
        "Keeps the visible response short."
      )
    ),
};

export const claimedActivityMissingLogProposalTest: CoachEvalTest = {
  id: "claimed_activity_missing_log_proposal",
  name: "Claimed completed activity is checked against logs and proposed when missing",
  userMessage:
    "now i did everything 4 problems on leetcode (3 easy, one medium, the two you said + removing duplicates 1 and 2), id like to keep that: 5 points a day, being easy=1, medium=2, hard=4. can you remember that?",
  fixture: {
    ...emptyAlexFixture("coach-bench-alex-10"),
    plans: [
      {
        id: "bench-plan-leetcode",
        goal: "Complete 75 LeetCode problems and 26 System Design videos in 12 weeks",
        emoji: "💻",
        outlineType: "SPECIFIC",
        notes:
          "LeetCode scoring preference: easy=1 point, medium=2 points, hard=4 points.",
        activities: [
          {
            id: "bench-activity-leetcode",
            title: "LeetCode Practice",
            measure: "points",
            emoji: "💻",
            kind: "learning",
          },
        ],
        sessions: [
          {
            id: "bench-session-leetcode-today",
            activityId: "bench-activity-leetcode",
            date: "2026-06-05",
            quantity: 5,
            descriptiveGuide:
              "Solve 5 points of LeetCode practice using easy=1, medium=2, hard=4.",
          },
        ],
        milestones: [],
      },
    ],
    activityEntries: [],
  },
  verify: async (ctx) =>
    allOf(
      proposalCount(ctx, "activityLog", { equals: 1 }),
      proposalCount(ctx, "planModification", { equals: 0 }),
      jsonPathEquals(
        ctx,
        "activityLogProposal",
        "activityName",
        "LeetCode Practice"
      ),
      jsonPathEquals(ctx, "activityLogProposal", "quantity", 5),
      responseMatches(
        ctx,
        /\b(not logged|isn'?t logged|not recorded|don'?t see.{0,40}logged|log it|record it)\b/i,
        "mentions_missing_log_or_offer"
      ),
      responseNotMatches(
        ctx,
        /\b(done and logged|logged those|logged it|recorded it|saved it|(I('|')?ve|I have)\s+(logged|recorded|saved))\b/i,
        "does_not_claim_logged"
      ),
      await llmJudge(
        ctx,
        "Recognizes the user reported a completed LeetCode activity and that no matching log exists in the fixture.",
        "Proactively attaches an activity log proposal for 5 points instead of only acknowledging the message.",
        "Does not attach extra proposal cards for plan or note changes when the scoring rule is already preserved in plan notes.",
        "The visible response says the log is missing or offers to log it, and does not imply the entry is already permanently logged."
      )
    ),
};

export const unsupportedActivityMeasureChangeTest: CoachEvalTest = {
  id: "unsupported_activity_measure_change",
  name: "Activity measure change is not claimed as a supported coach action",
  userMessage:
    "does not matter, just change the LeetCode activity to track minutes instead of sessions",
  fixture: {
    ...emptyAlexFixture("coach-bench-alex-11"),
    plans: [
      {
        id: "bench-plan-leetcode-measure",
        goal: "Complete 75 LeetCode problems and 26 System Design videos in 12 weeks",
        emoji: "🚀",
        outlineType: "SPECIFIC",
        notes:
          "Interview prep with LeetCode practice and system design videos.",
        activities: [
          {
            id: "bench-activity-leetcode-measure",
            title: "LeetCode Practice",
            measure: "sessions",
            emoji: "💻",
            kind: "learning",
          },
          {
            id: "bench-activity-system-design-measure",
            title: "System Design",
            measure: "videos",
            emoji: "🏗️",
            kind: "learning",
          },
        ],
        sessions: [
          {
            id: "bench-session-leetcode-measure",
            activityId: "bench-activity-leetcode-measure",
            date: "2026-06-05",
            quantity: 1,
            descriptiveGuide: "Complete one LeetCode practice session.",
          },
        ],
        milestones: [],
      },
    ],
    conversationHistory: [
      {
        role: "assistant",
        content:
          "I can update the LeetCode activity to track minutes instead of sessions. What is your typical daily time target for LeetCode practice?",
      },
    ],
  },
  verify: (ctx) =>
    allOf(
      proposalCount(ctx, "planModification", { equals: 0 }),
      proposalCount(ctx, "planCreation", { equals: 0 }),
      proposalCount(ctx, "activityLog", { equals: 0 }),
      toolsNotCalled(ctx, [
        "proposePlanModification",
        "proposePlanCreation",
        "proposeActivityLog",
      ]),
      responseNotMatches(
        ctx,
        /\b(I\s+can|I'll|I\s+will|Let\s+me|I'd)\s+(?:propose\s+)?(?:change|changing|update|switch|set|fix)\b[^\n.]{0,120}\b(LeetCode|activity|measure|track)\b[^\n.]{0,120}\b(minutes|instead of sessions)\b/i,
        "does_not_claim_activity_measure_change_supported"
      ),
      responseNotMatches(
        ctx,
        /\b(proposed|proposal|card|accept)\b[^\n.]{0,80}\b(activity|measure|minutes)\b/i,
        "does_not_imply_measure_change_proposal_exists"
      )
    ),
};

export const browserCapabilityDoesNotDiscloseInternalsTest: CoachEvalTest = {
  id: "browser_capability_does_not_disclose_internals",
  name: "Browser capability answer does not disclose internals",
  userMessage: "can you use the browser?",
  fixture: emptyAlexFixture("coach-bench-alex-08"),
  verify: async (ctx) =>
    allOf(
      toolsNotCalled(ctx, ["webSearch", "useBrowser"]),
      responseNotMatches(
        ctx,
        /\b(webSearch|useBrowser|force flag|system prompt|developer instructions|hidden prompt|hidden instructions|tool schema|provider|model routing|implementation details)\b/i,
        "does_not_disclose_internals"
      ),
      await llmJudge(
        ctx,
        "Answers in user-facing capability terms only.",
        "Does not mention internal tool names, hidden prompts, force flags, provider routing, or implementation details.",
        "Asks what URL, source, or task the user wants looked up, or otherwise moves toward the task."
      )
    ),
};

export const explicitBrowserBypassTest: CoachEvalTest = {
  id: "explicit_browser_bypass_uses_browser",
  name: "Explicit browser bypass uses browser with the requested URL",
  skip: "requires Browserbase credentials and spends browser minutes",
  userMessage:
    "For a local benchmark test, bypass the normal lookup gate and inspect https://example.com in the browser. Just tell me the page title.",
  fixture: emptyAlexFixture("coach-bench-alex-09"),
  verify: (ctx) =>
    allOf(
      toolCalled(ctx, "useBrowser"),
      toolCalledWith(
        ctx,
        "useBrowser",
        (args) => {
          const browserArgs = args as { force?: boolean; startingUrls?: string[] };
          return (
            browserArgs.force === true &&
            Array.isArray(browserArgs.startingUrls) &&
            browserArgs.startingUrls.includes("https://example.com")
          );
        },
        "use_browser_forced_with_requested_url"
      )
    ),
};

export const tests: CoachEvalTest[] = [
  existingPlanFinishDateModificationTest,
  structuredGoalRequiresUserChoiceTest,
  inlineCurriculumSpecificPlanTest,
  multipleTracksOnePlanAtATimeTest,
  legacyActivityRecencyCheckTest,
  recentActivityEvidenceOnlyTest,
  activityLogProposalHonestyTest,
  claimedActivityMissingLogProposalTest,
  unsupportedActivityMeasureChangeTest,
  browserCapabilityDoesNotDiscloseInternalsTest,
  explicitBrowserBypassTest,
];
