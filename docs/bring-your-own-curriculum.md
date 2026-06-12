# Bring your own curriculum

tracking.so plans are deliberately simple: a goal, activities, sessions, and the
visuals around them (heatmaps, streaks, weekly progress). Complex self-built
learning paths — a 12-week deep learning curriculum, a robotics track with
daily checklists — don't fit in a notes field, and they shouldn't have to.

Bring your own curriculum lets you attach a folder of markdown files (an
Obsidian vault folder, a git repo, anything) to a plan. The files stay the
source of truth for *content*; tracking.so stays the source of truth for
*state*: what you logged, your streaks, and the coach holding you to it.

The coach reads these files directly. When it prepares your week, repairs a
schedule gap, or discusses a plan in chat, it lists and reads the attached
curriculum (following `[[wiki-links]]` between files) instead of guessing from
the plan goal.

## What gets attached

- Markdown files (`.md`), up to 100 per plan, 200 KB each
- Relative paths are preserved (`notes/rules.md` stays `notes/rules.md`)
- Re-uploading replaces the bundle: files you removed locally are removed

## Option A: agent setup prompt (recommended)

Open **Settings → Integrations & API Keys** in the app, create an API key, and
copy the generated **setup prompt** into your agent (Claude Code, Codex,
Cursor). The prompt is fully readable before you send it; your agent then:

1. registers the MCP server (`https://api.tracking.so/mcp`, streamable HTTP,
   your key as a Bearer token),
2. installs the day-to-day usage skill from
   [`https://api.tracking.so/skill.md`](https://api.tracking.so/skill.md) into
   `~/.claude/skills/tracking-so/`,
3. verifies the connection with `get_user_state`,
4. and if your account has no plans yet, interviews you and creates your
   first plan, asking whether you have a curriculum to attach.

Keys can be managed in the same settings view (or via `GET/POST /api-keys`,
`DELETE /api-keys/:id`). Manual MCP registration, if you prefer:

```sh
claude mcp add --scope user --transport http tracking-so https://api.tracking.so/mcp \
  --header "Authorization: Bearer tsk_..."
```

### The tools

| Tool | What it does |
| --- | --- |
| `get_user_state` | Profile, plans with schedule health, recent logging — the "where do I stand" call |
| `list_plans` | Your active plans with ids, schedule state, and curriculum file counts |
| `create_plan` | Create a plan: frequency habit or dated-session curriculum, activities, milestones |
| `list_curriculum_files` | Files attached to a plan |
| `read_curriculum_file` | Read one file (raw markdown) |
| `replace_curriculum` | Replace the full bundle (removes files not included) |
| `upsert_curriculum_files` | Add or update specific files, keep the rest |

A typical session: *"Read my curriculum in `~/personal/learning`, tighten week
3, and push it to my robotics plan on tracking.so."*

## Option B: REST API

Same operations, plain HTTP (auth: session JWT or `tsk_` API key):

```
PUT    /plans/:planId/curriculum          { files: [{ path, content }] }
GET    /plans/:planId/curriculum
GET    /plans/:planId/curriculum/file?path=schedule.md
DELETE /plans/:planId/curriculum
```

## Option C: maintainer script (direct DB)

For self-hosters and development:

```sh
cd apps/backend-node
pnpm upload-curriculum --prod --username alex \
  --plan-goal "robotics" --dir ~/personal/learning
```

`--plan-goal` is a case-insensitive substring that must match exactly one
active plan. `--delete` removes the bundle instead.

## How the coach uses it

Plans with curriculum files get a context line telling the coach the files
exist and override the plan notes. The coach then uses its
`listCurriculumFiles` / `readCurriculumFile` tools during:

- weekly prep and session proposals
- schedule-gap repairs (the "needs planning" flow)
- any chat where the plan comes up

## Roadmap

- Checkbox write-back: logging a linked activity ticks the matching `- [ ]`
  item in your markdown, so the file reflects reality without manual editing
- Folder sync (GitHub webhook / Obsidian plugin) so re-uploads happen
  automatically
- `log_activity` over MCP, so agent work sessions feed your streaks directly
