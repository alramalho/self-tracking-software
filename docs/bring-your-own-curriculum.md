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

## Option A: MCP server (recommended)

The backend exposes an MCP server at `https://api.tracking.so/mcp`
(streamable HTTP). Any MCP client works — Claude Code, Claude.ai, Cursor.
This is also the intended authoring loop: have your AI tool research and write
the curriculum, then push it into tracking.so in the same session.

### 1. Create a personal API key

```sh
curl -X POST https://api.tracking.so/api-keys \
  -H "Authorization: Bearer <your session JWT>" \
  -H "Content-Type: application/json" \
  -d '{"label": "claude-code"}'
```

The response contains the key (`tsk_...`) exactly once — store it. Keys can be
listed (`GET /api-keys`) and revoked (`DELETE /api-keys/:id`).

### 2. Connect your MCP client

Claude Code:

```sh
claude mcp add --transport http tracking-so https://api.tracking.so/mcp \
  --header "Authorization: Bearer tsk_..."
```

### 3. Use the tools

| Tool | What it does |
| --- | --- |
| `list_plans` | Your active plans with ids, schedule state, and curriculum file counts |
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

- Settings UI for API keys (today: API only)
- Checkbox write-back: logging a linked activity ticks the matching `- [ ]`
  item in your markdown, so the file reflects reality without manual editing
- Folder sync (GitHub webhook / Obsidian plugin) so re-uploads happen
  automatically
