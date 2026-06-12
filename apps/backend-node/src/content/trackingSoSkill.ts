// Day-to-day usage skill for AI agents connected over MCP. Served at
// GET /skill.md so installed copies can be refreshed. Setup instructions
// live in the agent setup prompt (Settings -> Integrations), not here.
export const TRACKING_SO_SKILL = `---
name: tracking-so
description: Drive the user's tracking.so account (plans, progress, curriculum) over the tracking-so MCP tools. Use when the user mentions tracking.so, their plans, goals, logging, curriculum, schedules, or accountability — or at the start of work sessions related to a tracked goal.
---

# tracking.so

tracking.so is the user's accountability layer: plans (goals with either a
times-per-week target or specific dated sessions), logged activities feeding
streaks and heatmaps, an AI coach that keeps plans up to date, and a social
feed. You interact with it through the tracking-so MCP tools.

## Session start

When a conversation touches a tracked goal, call \`get_user_state\` early.
React to what it returns, in this order:

1. A plan with \`pastEndDate: true\` or \`futureSessions: 0\` (for SPECIFIC
   plans) needs attention. Tell the user before anything else and offer to
   help: extend the schedule, set a new finishing date, or suggest archiving
   in the app if the goal is done.
2. No plans at all: offer to set one up (see Creating plans).
3. Otherwise just proceed; mention progress only if relevant.

Do not repeat this check more than once per conversation.

## Tools

- \`get_user_state\` — profile, plans with schedule health, recent logging.
- \`list_plans\` — plan ids and schedule state.
- \`create_plan\` — create a plan (see below).
- \`list_curriculum_files\` / \`read_curriculum_file\` — read a plan's
  attached markdown curriculum.
- \`replace_curriculum\` / \`upsert_curriculum_files\` — write curriculum
  files. Replace swaps the whole bundle; upsert touches only listed files.

## Creating plans

Confirm with the user before calling \`create_plan\`: goal phrasing, an emoji,
schedule shape, and a finishing date (recommended — plans without end dates
drift).

- Frequency habits ("meditate 3x/week") → \`TIMES_PER_WEEK\` + \`timesPerWeek\`.
- Structured paths (courses, curricula, training blocks) → \`SPECIFIC\` with
  dated sessions. Schedule 1-2 weeks of sessions, not the whole plan: the
  coach and the user extend week by week, and stale far-future sessions are
  worse than none.
- Activities are the loggable units (e.g. "Deep learning study", measured in
  minutes). Reuse the user's existing activity titles when they fit.

After creating a structured plan, ask whether the user has a self-built
curriculum (markdown notes, an Obsidian folder) to attach.

## Curriculum

Curriculum files attached to a plan are the source of truth for its content —
the coach reads them when preparing the user's weeks. When writing them:

- Markdown only, relative paths (\`notes/rules.md\`), max 100 files, 200KB each.
- \`[[wiki-links]]\` between files are followed; use them for structure.
- Keep one file as the dated schedule overview; the coach keys off dates.
- Prefer \`upsert_curriculum_files\` for edits; \`replace_curriculum\` only
  when restructuring (it deletes files you omit).
- When the user does work that completes a curriculum item, update the file
  (tick the \`- [ ]\` checkbox) via \`upsert_curriculum_files\`.

## Boundaries

- Never create, overwrite, or restructure plans or curriculum without the
  user confirming the specifics first.
- Logging activities, archiving plans, and social features are not available
  over MCP yet; for those, send the user to https://app.tracking.so.
`;
